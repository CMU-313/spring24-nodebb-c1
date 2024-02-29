import assert = require('assert');
import Groups = require('../src/groups');
import User = require('../src/user');
import Categories = require('../src/categories');
import privileges = require('../src/privileges');

type CategoryTest = {
    cid: number,
};

type GroupTest = {
    name: string,
    memberCount: number,
};

describe('Groups', () => {
    let adminUid: number;
    let studentUid: number;
    let recruiterUid: number;
    let jobPostingsCategory: CategoryTest;
    before(async () => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await Groups.create({
            name: 'Recruiters',
            userTitle: 'Recruiters',
            description: 'Company recruiters',
            hidden: 0,
            private: 1,
            disableJoinRequests: 1,
        });

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        studentUid = await User.create({
            username: 'student',
            email: 'student@test.com',
        }) as number;

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        adminUid = await User.create({
            username: 'admin',
            email: 'admin@test.com',
        }) as number;
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await Groups.join('administrators', adminUid);

        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        recruiterUid = await User.create({
            username: 'recruiter',
            email: 'recruiter@test.com',
            accounttype: 'recruiter',
        }) as number;
    });

    it('Recruiters group should have one member', async (done) => {
        await Groups.get('Recruiters', {}, (err, groupObj: GroupTest) => {
            assert.ifError(err);
            assert.strictEqual(groupObj.name, 'Recruiters');
            assert.strictEqual(groupObj.memberCount, 1);

            done();
        });
    });

    it('recruiter user should automatically be in the Recruiters group', async (done) => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        await Groups.isMember(recruiterUid, 'Recruiters', (err, isMember) => {
            assert.ifError(err);
            assert.strictEqual(isMember, true);
            done();
        });
    });

    it('student user should not be in the Recruiters group', (done) => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        Groups.isMember(studentUid, 'Recruiters', (err, isMember) => {
            assert.ifError(err);
            assert.strictEqual(isMember, false);
            done();
        });
    });

    it('admin user should not be in the Recruiters group', (done) => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        Groups.isMember(adminUid, 'Recruiters', (err, isMember) => {
            assert.ifError(err);
            assert.strictEqual(isMember, false);
            done();
        });
    });

    it('should create a new job postings category', (done) => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        Categories.create({
            name: 'Job Postings',
            description: 'Check job postings from recruiters',
            icon: 'fa-check',
            blockclass: 'category-blue',
            order: '5',
        }, (err, category: CategoryTest) => {
            assert.ifError(err);

            jobPostingsCategory = category;
            done();
        });
    });

    it('should set privileges for job postings', async () => {
        const postingPrivileges = [
            'groups:topics:create',
            'groups:posts:edit',
            'groups:posts:delete',
            'groups:topics:delete',
        ];

        await Promise.all([
            privileges.categories.rescind(postingPrivileges, jobPostingsCategory.cid, 'registered-users'),
            privileges.categories.give(postingPrivileges, jobPostingsCategory.cid, 'Recruiters'),
        ]);
    });

    it('recruiters should have posting privileges on job postings category', async () => {
        const canCreateTopics: boolean = await privileges.categories.can(
            'topics:create',
            jobPostingsCategory.cid,
            recruiterUid
        ) as boolean;
        assert(canCreateTopics);

        const canDeleteTopics: boolean = await privileges.categories.can(
            'topics:delete',
            jobPostingsCategory.cid,
            recruiterUid
        ) as boolean;
        assert(canDeleteTopics);

        const canEditPosts: boolean = await privileges.categories.can(
            'posts:edit',
            jobPostingsCategory.cid,
            recruiterUid
        ) as boolean;
        assert(canEditPosts);

        const canDeletePosts: boolean = await privileges.categories.can(
            'posts:delete',
            jobPostingsCategory.cid,
            recruiterUid
        ) as boolean;
        assert(canDeletePosts);
    });

    it('students should not have posting privileges on job postings category', async () => {
        const canCreateTopics: boolean = await privileges.categories.can(
            'topics:create',
            jobPostingsCategory.cid,
            studentUid
        ) as boolean;

        assert(!canCreateTopics);

        const canDeleteTopics: boolean = await privileges.categories.can(
            'topics:delete',
            jobPostingsCategory.cid,
            studentUid
        ) as boolean;
        assert(!canDeleteTopics);

        const canEditPosts: boolean = await privileges.categories.can(
            'posts:edit',
            jobPostingsCategory.cid,
            studentUid
        ) as boolean;
        assert(!canEditPosts);

        const canDeletePosts: boolean = await privileges.categories.can(
            'posts:delete',
            jobPostingsCategory.cid,
            studentUid
        ) as boolean;
        assert(!canDeletePosts);
    });

    it('admins should have posting privileges on job postings category', async () => {
        const canCreateTopics: boolean = await privileges.categories.can(
            'topics:create',
            jobPostingsCategory.cid,
            adminUid
        ) as boolean;
        assert(canCreateTopics);

        const canDeleteTopics: boolean = await privileges.categories.can(
            'topics:delete',
            jobPostingsCategory.cid,
            adminUid
        ) as boolean;
        assert(canDeleteTopics);

        const canEditPosts: boolean = await privileges.categories.can(
            'posts:edit',
            jobPostingsCategory.cid,
            adminUid
        ) as boolean;
        assert(canEditPosts);

        const canDeletePosts: boolean = await privileges.categories.can(
            'posts:delete',
            jobPostingsCategory.cid,
            adminUid
        ) as boolean;
        assert(canDeletePosts);
    });
});
