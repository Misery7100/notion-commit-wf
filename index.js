import { Client } from "@notionhq/client"
import * as core from '@actions/core';

const SECRET_GITHUB = core.getInput('SECRET_GITHUB');
const NOTIONAPIKEY = core.getInput('NOTION_API_KEY');
const NOTION_DATABASE = core.getInput('NOTION_DATABASE');
const TASKS_DATABASE = core.getInput('TASKS_DATABASE'); // Add this input for the Tasks database ID
const OWNER = core.getInput('OWNER');
const REPO = core.getInput('REPO');

const notion = new Client({ auth: NOTIONAPIKEY });

async function findNotionPageIdByUniqueId(uniqueId) {
    try {
        const response = await notion.search({
            query: uniqueId,
            filter: {
                value: {
                    database: {
                        id: TASKS_DATABASE
                    }
                }
            }
        });
        if (response.results.length > 0) {
            return response.results[0].id; // Return the actual page ID of the first matching result
        }
        return null;
    } catch (error) {
        console.error(error.body);
        return null;
    }
}

async function addItem(title, message, time, committer, notionTaskId) {
    try {
        const response = await notion.pages.create({
            parent: { database_id: NOTION_DATABASE },
            properties: {
                "Title": {
                    title: [
                        {
                            text: {
                                content: title
                            }
                        }
                    ]
                },
                "Description": {
                    rich_text: [
                        {
                            text: {
                                content: message
                            }
                        }
                    ]
                },
                "Date": {
                    date: {
                        start: time
                    }
                },
                "Committed by": {
                    rich_text: [
                        {
                            text: {
                                content: committer
                            }
                        }
                    ]
                },
                "Task": {
                    relation: [
                        {
                            id: notionTaskId
                        }
                    ]
                }
            },
        });
        console.log("Success! Commit pushed to notion.");
    } 
    catch (error) {
        console.error(error.body);
    }
}

import { Octokit } from "@octokit/core";
const octokit = new Octokit({
    auth: SECRET_GITHUB
});

const filter = (val) => {
    return (val != '' && val && val.length > 0);
}

let response = await octokit.request('GET /repos/{owner}/{repo}/commits/heads/main', {
    owner: OWNER,
    repo: REPO,
    headers: {
        'X-GitHub-Api-Version': '2022-11-28'
    }
});

const commit = response.data.commit;
let time = new Date(commit.committer.date);

let messages = commit.message.split('\n');
messages = messages.filter(filter);

let title = messages[0];
let committer = (commit.committer.name);
messages.splice(0, 1);
let message = messages.join('\n');

// Extract Notion Task ID from the title
const notionTaskIdMatch = title.match(/^\[(.*?)\]/);
if (!notionTaskIdMatch) {
    console.error("No Notion Task ID found in commit message.");
    process.exit(1);
}
const uniqueId = notionTaskIdMatch[1];

const actualNotionPageId = await findNotionPageIdByUniqueId(uniqueId);
if (!actualNotionPageId) {
    console.error("No matching Notion page found for the unique ID:", uniqueId);
    process.exit(1);
}

addItem(title, message, time, committer, actualNotionPageId);