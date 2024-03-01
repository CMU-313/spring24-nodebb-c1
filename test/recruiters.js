"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const Groups = require("../src/groups");
const User = require("../src/user");
const Categories = require("../src/categories");
const privileges = require("../src/privileges");
describe('Groups', () => {
    let adminUid;
    let studentUid;
    let recruiterUid;
    let jobPostingsCategory;
    before(() => __awaiter(void 0, void 0, void 0, function* () {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        Groups.create({
            name: 'Recruiters',
            userTitle: 'Recruiters',
            description: 'Company recruiters',
            hidden: 0,
            private: 1,
            disableJoinRequests: 1,
        });
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        studentUid = (yield User.create({
            username: 'student',
            email: 'student@test.com',
        }));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        adminUid = (yield User.create({
            username: 'admin',
            email: 'admin@test.com',
        }));
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        yield Groups.join('administrators', adminUid);
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        recruiterUid = (yield User.create({
            username: 'recruiter',
            email: 'recruiter@test.com',
            accounttype: 'recruiter',
        }));
    }));
    it('Recruiters group should have one member', (done) => {
        Groups.get('Recruiters', {}, (err, groupObj) => {
            assert.ifError(err);
            assert.strictEqual(groupObj.name, 'Recruiters');
            assert.strictEqual(groupObj.memberCount, 1);
            done();
        }).catch(() => 'obligatory catch');
    });
    it('recruiter user should automatically be in the Recruiters group', (done) => {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        Groups.isMember(recruiterUid, 'Recruiters', (err, isMember) => {
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
        }, (err, category) => {
            assert.ifError(err);
            jobPostingsCategory = category;
            done();
        });
    });
    it('should set privileges for job postings', () => __awaiter(void 0, void 0, void 0, function* () {
        const postingPrivileges = [
            'groups:topics:create',
            'groups:posts:edit',
            'groups:posts:delete',
            'groups:topics:delete',
        ];
        yield Promise.all([
            privileges.categories.rescind(postingPrivileges, jobPostingsCategory.cid, 'registered-users'),
            privileges.categories.give(postingPrivileges, jobPostingsCategory.cid, 'Recruiters'),
        ]);
    }));
    it('recruiters should have posting privileges on job postings category', () => __awaiter(void 0, void 0, void 0, function* () {
        const canCreateTopics = yield privileges.categories.can('topics:create', jobPostingsCategory.cid, recruiterUid);
        assert(canCreateTopics);
        const canDeleteTopics = yield privileges.categories.can('topics:delete', jobPostingsCategory.cid, recruiterUid);
        assert(canDeleteTopics);
        const canEditPosts = yield privileges.categories.can('posts:edit', jobPostingsCategory.cid, recruiterUid);
        assert(canEditPosts);
        const canDeletePosts = yield privileges.categories.can('posts:delete', jobPostingsCategory.cid, recruiterUid);
        assert(canDeletePosts);
    }));
    it('students should not have posting privileges on job postings category', () => __awaiter(void 0, void 0, void 0, function* () {
        const canCreateTopics = yield privileges.categories.can('topics:create', jobPostingsCategory.cid, studentUid);
        assert(!canCreateTopics);
        const canDeleteTopics = yield privileges.categories.can('topics:delete', jobPostingsCategory.cid, studentUid);
        assert(!canDeleteTopics);
        const canEditPosts = yield privileges.categories.can('posts:edit', jobPostingsCategory.cid, studentUid);
        assert(!canEditPosts);
        const canDeletePosts = yield privileges.categories.can('posts:delete', jobPostingsCategory.cid, studentUid);
        assert(!canDeletePosts);
    }));
    it('admins should have posting privileges on job postings category', () => __awaiter(void 0, void 0, void 0, function* () {
        const canCreateTopics = yield privileges.categories.can('topics:create', jobPostingsCategory.cid, adminUid);
        assert(canCreateTopics);
        const canDeleteTopics = yield privileges.categories.can('topics:delete', jobPostingsCategory.cid, adminUid);
        assert(canDeleteTopics);
        const canEditPosts = yield privileges.categories.can('posts:edit', jobPostingsCategory.cid, adminUid);
        assert(canEditPosts);
        const canDeletePosts = yield privileges.categories.can('posts:delete', jobPostingsCategory.cid, adminUid);
        assert(canDeletePosts);
    }));
});
