'use strict';

const async = require('async');
const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const posts = require('../posts');
const notifications = require('../notifications');
const categories = require('../categories');
const privileges = require('../privileges');
const meta = require('../meta');
const utils = require('../utils');
const plugins = require('../plugins');

module.exports = function (Topics) {
    Topics.getTotalUnresolved = async function (uid, filter) {
        filter = filter || '';
        const counts = await Topics.getUnresolvedTids({ cid: 0, uid: uid, count: true });
        return counts && counts[filter];
    };

    Topics.getUnresolvedTopics = async function (params) {
        const unresolvedTopics = {
            showSelect: true,
            nextStart: 0,
            topics: [],
        };
        let tids = await Topics.getUnresolvedTids(params);
        unresolvedTopics.topicCount = tids.length;

        if (!tids.length) {
            return unresolvedTopics;
        }

        tids = tids.slice(params.start, params.stop !== -1 ? params.stop + 1 : undefined);

        const topicData = await Topics.getTopicsByTids(tids, params.uid);
        if (!topicData.length) {
            return unresolvedTopics;
        }
        Topics.calculateTopicIndices(topicData, params.start);
        unresolvedTopics.topics = topicData;
        unresolvedTopics.nextStart = params.stop + 1;
        return unresolvedTopics;
    };

    Topics.unresolvedCutoff = async function (uid) {
        const cutoff = Date.now() - (meta.config.unresolvedCutoff * 86400000);
        const data = await plugins.hooks.fire('filter:topics.unresolvedCutoff', { uid: uid, cutoff: cutoff });
        return parseInt(data.cutoff, 10);
    };

    Topics.getUnresolvedTids = async function (params) {
        const results = await Topics.getUnresolvedData(params);
        return params.count ? results.counts : results.tids;
    };

    Topics.getUnresolvedData = async function (params) {
        const uid = parseInt(params.uid, 10);

        params.filter = params.filter || '';

        if (params.cid && !Array.isArray(params.cid)) {
            params.cid = [params.cid];
        }

        const data = await getTids(params);
        if (uid <= 0 || !data.tids || !data.tids.length) {
            return data;
        }

        const result = await plugins.hooks.fire('filter:topics.getUnresolvedTids', {
            uid: uid,
            tids: data.tids,
            counts: data.counts,
            tidsByFilter: data.tidsByFilter,
            cid: params.cid,
            filter: params.filter,
            query: params.query || {},
        });
        return result;
    };

    async function getTids(params) {
        const counts = { '': 0, new: 0, watched: 0, unreplied: 0 };
        const tidsByFilter = { '': [], new: [], watched: [], unreplied: [] };

        if (params.uid <= 0) {
            return { counts: counts, tids: [], tidsByFilter: tidsByFilter };
        }

        params.cutoff = await Topics.unresolvedCutoff(params.uid);

        const [followedTids, ignoredTids, categoryTids, userScores, tids_unresolved] = await Promise.all([
            getFollowedTids(params),
            user.getIgnoredTids(params.uid, 0, -1),
            getCategoryTids(params),
            db.getSortedSetRevRangeByScoreWithScores(`uid:${params.uid}:tids_resolved`, 0, -1, '+inf', params.cutoff),
            db.getSortedSetRevRangeWithScores(`uid:${params.uid}:tids_unresolved`, 0, -1),
        ]);

        const userResolvedTimes = _.mapValues(_.keyBy(userScores, 'value'), 'score');
        const isTopicsFollowed = {};
        followedTids.forEach((t) => {
            isTopicsFollowed[t.value] = true;
        });
        const unresolvedFollowed = await db.isSortedSetMembers(
            `uid:${params.uid}:followed_tids`, tids_unresolved.map(t => t.value)
        );

        tids_unresolved.forEach((t, i) => {
            isTopicsFollowed[t.value] = unresolvedFollowed[i];
        });

        const unresolvedTopics = _.unionWith(categoryTids, followedTids, (a, b) => a.value === b.value)
            .filter(t => !ignoredTids.includes(t.value) &&
                    (!userReadTimes[t.value] || t.score > userResolvedTimes[t.value]))
            .concat(tids_unread.filter(t => !ignoredTids.includes(t.value)))
            .sort((a, b) => b.score - a.score);

        let tids = _.uniq(unresolvedTopics.map(topic => topic.value)).slice(0, 200);

        if (!tids.length) {
            return { counts: counts, tids: tids, tidsByFilter: tidsByFilter };
        }

        const blockedUids = await user.blocks.list(params.uid);

        tids = await filterTidsThatHaveBlockedPosts({
            uid: params.uid,
            tids: tids,
            blockedUids: blockedUids,
            recentTids: categoryTids,
        });

        tids = await privileges.topics.filterTids('topics:resolved', tids, params.uid);
        const topicData = (await Topics.getTopicsFields(tids, ['tid', 'cid', 'uid', 'postcount', 'deleted', 'scheduled']))
            .filter(t => t.scheduled || !t.deleted);
        const topicCids = _.uniq(topicData.map(topic => topic.cid)).filter(Boolean);

        const categoryWatchState = await categories.getWatchState(topicCids, params.uid);
        const userCidState = _.zipObject(topicCids, categoryWatchState);

        const filterCids = params.cid && params.cid.map(cid => parseInt(cid, 10));

        topicData.forEach((topic) => {
            if (topic && topic.cid && (!filterCids || filterCids.includes(topic.cid)) &&
                !blockedUids.includes(topic.uid)) {
                if (isTopicsFollowed[topic.tid] || userCidState[topic.cid] === categories.watchStates.watching) {
                    tidsByFilter[''].push(topic.tid);
                }

                if (isTopicsFollowed[topic.tid]) {
                    tidsByFilter.watched.push(topic.tid);
                }

                if (topic.postcount <= 1) {
                    tidsByFilter.unreplied.push(topic.tid);
                }

                if (!userReadTimes[topic.tid]) {
                    tidsByFilter.new.push(topic.tid);
                }
            }
        });

        counts[''] = tidsByFilter[''].length;
        counts.watched = tidsByFilter.watched.length;
        counts.unreplied = tidsByFilter.unreplied.length;
        counts.new = tidsByFilter.new.length;

        return {
            counts: counts,
            tids: tidsByFilter[params.filter],
            tidsByFilter: tidsByFilter,
        };
    }

    async function getCategoryTids(params) {
        if (plugins.hooks.hasListeners('filter:topics.unresolved.getCategoryTids')) {
            const result = await plugins.hooks.fire('filter:topics.unresolved.getCategoryTids', { params: params, tids: [] });
            return result.tids;
        }
        if (params.filter === 'watched') {
            return [];
        }
        const cids = params.cid || await user.getWatchedCategories(params.uid);
        const keys = cids.map(cid => `cid:${cid}:tids:lastposttime`);
        return await db.getSortedSetRevRangeByScoreWithScores(keys, 0, -1, '+inf', params.cutoff);
    }

    async function getFollowedTids(params) {
        let tids = await db.getSortedSetMembers(`uid:${params.uid}:followed_tids`);
        const filterCids = params.cid && params.cid.map(cid => parseInt(cid, 10));
        if (filterCids) {
            const topicData = await Topics.getTopicsFields(tids, ['tid', 'cid']);
            tids = topicData.filter(t => filterCids.includes(t.cid)).map(t => t.tid);
        }
        const scores = await db.sortedSetScores('topics:recent', tids);
        const data = tids.map((tid, index) => ({ value: String(tid), score: scores[index] }));
        return data.filter(item => item.score > params.cutoff);
    }

    async function filterTidsThatHaveBlockedPosts(params) {
        if (!params.blockedUids.length) {
            return params.tids;
        }
        const topicScores = _.mapValues(_.keyBy(params.recentTids, 'value'), 'score');

        const results = await db.sortedSetScores(`uid:${params.uid}:tids_resolved`, params.tids);

        const userScores = _.zipObject(params.tids, results);

        return await async.filter(params.tids, async tid => await doesTidHaveUnblockedUnreadPosts(tid, {
            blockedUids: params.blockedUids,
            topicTimestamp: topicScores[tid],
            userLastReadTimestamp: userScores[tid],
        }));
    }

    async function doesTidHaveUnblockedUnresolvedPosts(tid, params) {
        const { userLastResolvedTimestamp } = params;
        if (!userLastResolvedTimestamp) {
            return true;
        }
        let start = 0;
        const count = 3;
        let done = false;
        let hasUnblockedUnresolved = params.topicTimestamp > userLastResolvedTimestamp;
        if (!params.blockedUids.length) {
            return hasUnblockedUnresolved;
        }
        while (!done) {
            /* eslint-disable no-await-in-loop */
            const pidsSinceLastVisit = await db.getSortedSetRangeByScore(`tid:${tid}:posts`, start, count, userLastResolvedTimestamp, '+inf');
            if (!pidsSinceLastVisit.length) {
                return hasUnblockedUnresolved;
            }
            let postData = await posts.getPostsFields(pidsSinceLastVisit, ['pid', 'uid']);
            postData = postData.filter(post => !params.blockedUids.includes(parseInt(post.uid, 10)));

            done = postData.length > 0;
            hasUnblockedUnresolved = postData.length > 0;
            start += count;
        }
        return hasUnblockedUnresolved;
    }

    Topics.pushUnresolvedCount = async function (uid) {
        if (!uid || parseInt(uid, 10) <= 0) {
            return;
        }
        const results = await Topics.getUnresolvedTids({ uid: uid, count: true });
        require('../socket.io').in(`uid_${uid}`).emit('event:unresolved.updateCount', {
            unresolvedTopicCount: results[''],
            unresolvedNewTopicCount: results.new,
            unresolvedWatchedTopicCount: results.watched,
            unresolvedUnrepliedTopicCount: results.unreplied,
        });
    };

    Topics.markAsUnresolvedForAll = async function (tid) {
        await Topics.markCategoryUnresolvedForAll(tid);
    };

    Topics.markAsResolved = async function (tid) {
        console.log("here");
        const [topicData] = await Promise.all([
            db.setAdd(`tid:${tid}:resolved`, 0),
            db.setRemove(`tid:${tid}:unresolved`, 0),
        ]);

        plugins.hooks.fire('action:topics.markAsResolved', { tid: tid });
        return true;
    };

    Topics.markAsUnresolved = async function (tid) {
        console.log("here");
        const [topicData] = await Promise.all([
            db.setAdd(`tid:${tid}:unresolved`, 0),
            db.setRemove(`tid:${tid}:resolved`, 0),
        ]);

        plugins.hooks.fire('action:topics.markAsUnresolved', { tid: tid });
        return true;
    };

    Topics.markTopicNotificationsRead = async function (tids, uid) {
        if (!Array.isArray(tids) || !tids.length) {
            return;
        }
        const nids = await user.notifications.getUnreadByField(uid, 'tid', tids);
        await notifications.markReadMultiple(nids, uid);
        user.notifications.pushCount(uid);
    };

    Topics.markCategoryUnresolvedForAll = async function (tid) {
        const cid = await Topics.getTopicField(tid, 'cid');
        await categories.markAsUnresolvedForAll(cid);
    };

    Topics.hasResolvedTopics = async function (tids, uid) {
        if (!(parseInt(uid, 10) > 0)) {
            return tids.map(() => false);
        }
        const [topicScores, userScores, tids_unresolved, blockedUids] = await Promise.all([
            db.sortedSetScores('topics:recent', tids),
            db.sortedSetScores(`uid:${uid}:tids_resolved`, tids),
            db.sortedSetScores(`uid:${uid}:tids_unresolved`, tids),
            user.blocks.list(uid),
        ]);

        const cutoff = await Topics.unresolvedCutoff(uid);
        const result = tids.map((tid, index) => {
            const read = !tids_unresolved[index] &&
                (topicScores[index] < cutoff ||
                !!(userScores[index] && userScores[index] >= topicScores[index]));
            return { tid: tid, read: read, index: index };
        });

        return await async.map(result, async (data) => {
            if (data.read) {
                return true;
            }
            const hasUnblockedUnresolved = await doesTidHaveUnblockedUnresolvedPosts(data.tid, {
                topicTimestamp: topicScores[data.index],
                userLastResolvedTimestamp: userScores[data.index],
                blockedUids: blockedUids,
            });
            if (!hasUnblockedUnresolved) {
                data.read = true;
            }
            return data.read;
        });
    };

    Topics.hasResolvedTopic = async function (tid, uid) {
        const hasResolved = await Topics.hasResolvedTopics([tid], uid);
        return Array.isArray(hasResolved) && hasResolved.length ? hasResolved[0] : false;
    };

    Topics.markUnresolved = async function (tid) {
        const exists = await Topics.exists(tid);
        if (!exists) {
            throw new Error('[[error:no-topic]]');
        }
        await db.setRemove(`tid:${tid}:resolved`);
        await db.setAdd(`tid:${tid}:unresolved`, Date.now(), tid);
    };
};