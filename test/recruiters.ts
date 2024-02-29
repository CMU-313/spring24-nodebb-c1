'use strict';

const assert = require('assert');
const async = require('async');
const fs = require('fs');
const path = require('path');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const helpers = require('./helpers');
const Groups = require('../src/groups');
const User = require('../src/user');
const meta = require('../src/meta');
const navigation = require('../src/navigation/admin');
const Categories = require('../src/categories');
const privileges = require('../src/privileges');
const install = require('../src/install');

describe('Groups', () => {
	let adminUid;
	let studentUid;
	let recruiterUid;
	let jobPostingsCategory;
	before(async () => {
		const navData = require('../install/data/navigation.json');
		await navigation.save(navData);

		await Groups.create({
			name: 'Recruiters',
			userTitle: 'Recruiters',
			description: 'Company recruiters',
			hidden: 0,
			private: 1,
			disableJoinRequests: 1,
		});

		studentUid = await User.create({
			username: 'student',
			email: 'student@test.com',
		});

		adminUid = await User.create({
			username: 'admin',
			email: 'admin@test.com',
		});
		await Groups.join('administrators', adminUid);

		recruiterUid = await User.create({
			username: 'recruiter',
			email: 'recruiter@test.com',
			accounttype: 'recruiter'
		});
	});

	it('Recruiters group should have one member', (done) => {
		Groups.get('Recruiters', {}, (err, groupObj) => {
			assert.ifError(err);
			assert.strictEqual(groupObj.name, 'Recruiters');
			assert.strictEqual(groupObj.memberCount, 1);

			done();
		});
	});

	it('recruiter user should automatically be in the Recruiters group', (done) => {
		Groups.isMember(recruiterUid, 'Recruiters', (err, isMember) => {
			assert.ifError(err);
			assert.strictEqual(isMember, true);
			done();
		});
	});

	it('student user should not be in the Recruiters group', (done) => {
		Groups.isMember(studentUid, 'Recruiters', (err, isMember) => {
			assert.ifError(err);
			assert.strictEqual(isMember, false);
			done();
		});
	});

	it('admin user should not be in the Recruiters group', (done) => {
		Groups.isMember(adminUid, 'Recruiters', (err, isMember) => {
			assert.ifError(err);
			assert.strictEqual(isMember, false);
			done();
		});
	});

	it('should create a new job postings category', (done) => {
		Categories.create({
			name: 'Job Postings',
			description: 'Check job postings from recruiters',
			icon: 'fa-check',
			blockclass: 'category-blue',
			order: '5',
		}, (err, category) => {
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
			privileges.categories.give(postingPrivileges, jobPostingsCategory.cid, 'Recruiters')
		]);
	});

	it('recruiters should have posting privileges on job postings category', async () => {
		const canCreateTopics = await privileges.categories.can('topics:create',
			jobPostingsCategory.cid, recruiterUid);
		assert(canCreateTopics);

		const canDeleteTopics = await privileges.categories.can('topics:delete', 
			jobPostingsCategory.cid, recruiterUid);
		assert(canDeleteTopics);

		const canEditPosts = await privileges.categories.can('posts:edit',
			jobPostingsCategory.cid, recruiterUid);
		assert(canEditPosts);

		const canDeletePosts = await privileges.categories.can('posts:delete',
			jobPostingsCategory.cid, recruiterUid);
		assert(canDeletePosts);
	});

	it('students should not have posting privileges on job postings category', async () => {
		const canCreateTopics = await privileges.categories.can('topics:create',
			jobPostingsCategory.cid, studentUid);
		assert(!canCreateTopics);

		const canDeleteTopics = await privileges.categories.can('topics:delete',
			jobPostingsCategory.cid, studentUid);
		assert(!canDeleteTopics);

		const canEditPosts = await privileges.categories.can('posts:edit',
			jobPostingsCategory.cid, studentUid);
		assert(!canEditPosts);

		const canDeletePosts = await privileges.categories.can('posts:delete',
			jobPostingsCategory.cid, studentUid);
		assert(!canDeletePosts);
	});

	it('admins should have posting privileges on job postings category', async () => {
		const canCreateTopics = await privileges.categories.can('topics:create',
			jobPostingsCategory.cid, adminUid);
		assert(canCreateTopics);

		const canDeleteTopics = await privileges.categories.can('topics:delete',
			jobPostingsCategory.cid, adminUid);
		assert(canDeleteTopics);

		const canEditPosts = await privileges.categories.can('posts:edit',
			jobPostingsCategory.cid, adminUid);
		assert(canEditPosts);

		const canDeletePosts = await privileges.categories.can('posts:delete',
			jobPostingsCategory.cid, adminUid);
		assert(canDeletePosts);
	});
})