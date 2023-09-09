import { Client } from "@notionhq/client"
import * as core from '@actions/core';

const SECRET_GITHUB = core.getInput('SECRET_GITHUB');
const NOTIONAPIKEY = core.getInput('NOTION_API_KEY');
const NOTION_DATABASE = core.getInput('NOTION_DATABASE');
const TASKS_DATABASE = core.getInput('TASKS_DATABASE'); // Add this input for the Tasks database ID
const OWNER = core.getInput('OWNER');
const REPO = core.getInput('REPO');
const REFS = core.getInput('REFS');

const notion = new Client({ auth: NOTIONAPIKEY });

async function findNotionPageIdByUniqueId(uniqueId) {
    try {
        const response = await notion.databases.query({
            database_id: TASKS_DATABASE,
            filter: {
                "or": [
                  {
                    "property": "ID",
                    "number": {
                        "equals": uniqueId
                    }
                  } 
                ]
              },
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

async function addItem(title, message, time, committer, notionTaskId, url) {
    try {
        const response = await notion.pages.create({
            parent: { database_id: NOTION_DATABASE },
            icon: {
                type: "external",
                external: {
                    url: "https://imgur.com/PADmSx8.png"
                }
            },
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
                "Commited by": {
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
                },
                "URL": {
                    url: url
                }
            },
        });
        console.log("Success! Commit pushed to notion.");
        return response;
    } 
    catch (error) {
        console.error(error.body);
        return null;
    }
}

import { Octokit } from "@octokit/core";
const octokit = new Octokit({
    auth: SECRET_GITHUB
});

const filter = (val) => {
    return (val != '' && val && val.length > 0);
}

let response = await octokit.request('GET /repos/{owner}/{repo}/commits/{refs}', {
    owner: OWNER,
    repo: REPO,
    refs: REFS,
    headers: {
        'X-GitHub-Api-Version': '2022-11-28'
    }
});

const commit = response.data.commit;
let commitUrl = response.data.html_url;
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
const idNumberMatch = parseInt(uniqueId.match(/\d+/)[0], 10);

const actualNotionPageId = await findNotionPageIdByUniqueId(idNumberMatch);
if (!actualNotionPageId) {
    console.error("No matching Notion page found for the unique ID:", uniqueId);
    process.exit(1);
}

const res = addItem(title, message, time, committer, actualNotionPageId, commitUrl);
if (!res) {
    console.error("Failed to add item to Notion.");
    process.exit(1);
}