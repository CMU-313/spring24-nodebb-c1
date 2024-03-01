# User Guide

## Custom Composer Feature
To use some of the new features implemented, the default composer plugin must be deactivated with a custom plugin installed. The custom plugin can be found in `/src/plugins/nodebb-composer-custom`. Once are accessing that directory, please do the following:
- Run `npm link` in the composer’s directory
- Return to the root directory, and run `npm link nodebb-composer-custom` in the root directory
- Start NodeBB, log in using an admin account, and visit the admin panel
- Under the “Plugins” tab, select “Install Plugins”
- After being redirected, click on “Installed” button, directly to the right of trending button
- Deactivate nodebb-plugin-composer-default and activate nodebb-plugin-composer-custom
- Restart NodeBB

To test functionality, create a new topic/post. When you do, you should:
- See a save as draft option, which should allow you to save the current progress you have as a draft
- No interaction or scrolling is possible while the new topic/post page is open


## Companies
To view companies registered on NodeBB, navigate to the Companies page. When you do, you should:
- Click on your profile picture in the top right corner
- Find Companies in the dropdown menu and click on it to navigate to the corresponding page
- To see the button for creating company pages, ensure you registered as an instructor or recruiter

## Recruiters
New recruiter accounts can be made through the registration page by selecting “Recruiter” in the account type dropdown field. 
- Once the new account has been registered, you can verify that it is a recruiter account by checking if there is a yellow briefcase icon displayed next to the user’s name on the user profile, the users page, and any posts made by the user. 
- New recruiter accounts should be automatically added to a “Recruiters” group.

Job postings can be accessed from the category list on the home page. 
- If you are logged in as a recruiter, you should be able to create new topics in the job postings category. 
- If you are logged in as any other (non-admin) user type, you should only be able to view postings and not create them.

Automated tests for recruiter functionality can be found in `test/recruiters.ts`. They test correct membership in the Recruiters group and access permissions for the job postings category. I believe that these tests are sufficient because the main changes made to the backend involved the introduction of the Recruiters group and the job postings category. NodeBB does not have an established test suite for the frontend, and we did not have enough time to create one on our own.

## Q&A Resolution
To mark a post as resolved/unresolved,
- Make a post on the Questions & Comments section
- Click on the post and toggle the marked resolved/unresolved to reach the desired status
