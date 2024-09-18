const core = require('@actions/core');
const github = require('@actions/github');

var customDomains = core.getInput('custom-domains')?.split(/(\s+)/) ?? [];
var prNumber = core.getInput('pr-number') ?? github.context.issue.number;

const keyPhrases = 'depends on|blocked by';
const issueTypes = 'issues|pull';
const domainsList = ['github.com'].concat(customDomains); // add others from parameter
const domainsString = combineDomains(domainsList);

const quickLinkRegex = new RegExp(`(${keyPhrases}):? #(\\d+)`, 'gmi');
const partialLinkRegex = new RegExp(`(${keyPhrases}):? ([-_\\w]+)\\/([-._a-z0-9]+)(#)(\\d+)`, 'gmi');
const partialUrlRegex = new RegExp(`(${keyPhrases}):? ([-_\\w]+)\\/([-._a-z0-9]+)\\/(${issueTypes})\\/(\\d+)`, 'gmi');
const fullUrlRegex = new RegExp(`(${keyPhrases}):? https?:\\/\\/(?:${domainsString})\\/([-_\\w]+)\\/([-._a-z0-9]+)\\/(${issueTypes})\\/(\\d+)`, 'gmi');
const markdownRegex = new RegExp(`(${keyPhrases}):? \\[.*\\]\\(https?:\\/\\/(?:${domainsString})\\/([-_\\w]+)\\/([-._a-z0-9]+)\\/(${issueTypes})\\/(\\d+)\\)`, 'gmi');

function escapeDomainForRegex(domain) {
    return domain.replace('.', '\\.');
}

function combineDomains(domains) {
    return domains.map(x => escapeDomainForRegex(x)).join("|");
}

function extractFromMatch(match) {
    return {
        owner: match[2],
        repo: match[3],
        pull_number: parseInt(match[5], 10)
    };
}

function getAllDependencies(body) {
    var allMatches = [];

    var quickLinkMatches = [...body.matchAll(quickLinkRegex)];
    if (quickLinkMatches.length !== 0) {
        quickLinkMatches.forEach(match => {
            core.info(`  Found number-referenced dependency in '${match}'`);
            allMatches.push({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                pull_number: parseInt(match[2], 10)
            });
        });
    }

    var extractableMatches = [...body.matchAll(partialLinkRegex)]
        .concat([...body.matchAll(partialUrlRegex)])
        .concat([...body.matchAll(fullUrlRegex)])
        .concat([...body.matchAll(markdownRegex)]);
    if (extractableMatches.length !== 0) {
        extractableMatches.forEach(match => {
            core.info(`  Found number-referenced dependency in '${match}'`);
            allMatches.push(extractFromMatch(match));
        });
    }

    return allMatches;
}

async function evaluate() {
    try {
        core.info('Initializing...');
        const myToken = process.env.GITHUB_TOKEN;
        const octokit = github.getOctokit(myToken);

        const { data: pullRequest } = await octokit.pulls.get({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: prNumber,
        });

        if (!pullRequest.body){
            core.info('body empty')
            return;
        }

        core.info('\nReading PR body...');
        var dependencies = getAllDependencies(pullRequest.body);

        core.info('\nAnalyzing lines...');
        var dependencyIssues = [];
        for (var d of dependencies) {
            core.info(`  Fetching '${JSON.stringify(d)}'`);
            var isPr = true;
            var response = await octokit.pulls.get(d).catch(error => core.error(error));
            if (response === undefined) {
                isPr = false;
                d = {
                    owner: d.owner,
                    repo: d.repo,
                    issue_number: d.pull_number,
                };
                core.info(`  Fetching '${JSON.stringify(d)}'`);
                response = await octokit.issues.get(d).catch(error => core.error(error));
                if (response === undefined) {
                    core.info('    Could not locate this dependency.  Will need to verify manually.');
                    continue;
                }
            }
            if (isPr) {
                const { data: pr } = response;
                if (!pr) continue;
                if (!pr.merged && !pr.closed_at) {
                    core.info('    PR is still open.');
                    dependencyIssues.push(pr);
                } else {
                    core.info('    PR has been closed.');
                }
            } else {
                const { data: issue } = response;
                if (!issue) continue;
                if (!issue.closed_at) {
                    core.info('    Issue is still open.');
                    dependencyIssues.push(issue);
                } else {
                    core.info('    Issue has been closed.');
                }
            }
        }

        if (dependencyIssues.length !== 0) {
            var msg = '\nThe following issues need to be resolved before this PR can be merged:\n';
            for (var pr of dependencyIssues) {
                msg += `\n#${pr.number} - ${pr.title}`;
            }
            core.setFailed(msg);
        } else {
            core.info("\nAll dependencies have been resolved!")
        }
    } catch (error) {
        core.setFailed(error.message);
        throw error;
    }
}

module.exports = {
    evaluate: evaluate,
    getAllDependencies: getAllDependencies
}
