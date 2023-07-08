import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    core.debug('Started run')
    const githubToken = core.getInput('GITHUB_TOKEN')

    const octokit = github.getOctokit(githubToken)
    const context = github.context
    if (context.payload.pull_request) {
      const commits = await octokit.paginate(
        octokit.rest.pulls.listCommits,
        {
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: context.payload.pull_request.number
        },
        response => response.data
      )

      for await (const commit of commits) {
        core.debug(`Processing ${commit.sha}`)
        const fullCommit = await octokit.rest.repos.getCommit({
          owner: context.repo.owner,
          repo: context.repo.repo,
          ref: commit.sha
        })
        if (fullCommit.data.files) {
          for (const file of fullCommit.data.files) {
            core.debug(`Processing ${file.filename}`)
            const lines = file.patch?.split(/\r\n|\r|\n/)
            if (lines) {
              let leftLineNumber = 0
              let rightLineNumber = 0
              for (const line of lines) {
                core.debug(`Processing ${line}`)
                const lineNumbers = line.match(/@@ -(\d+),\d+ \+(\d+),\d+ @@/)
                if (lineNumbers) {
                  core.debug(JSON.stringify(lineNumbers))
                  leftLineNumber = parseInt(lineNumbers[1])
                  rightLineNumber = parseInt(lineNumbers[2])
                } else if (line.startsWith('+')) {
                  core.debug(
                    `Posting review comment to ${file.filename} - RIGHT - ${rightLineNumber}`
                  )
                  await octokit.rest.pulls.createReviewComment({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: context.payload.pull_request.number,
                    body: `Test - ${rightLineNumber} - RIGHT - ${line}`,
                    path: file.filename,
                    line: rightLineNumber,
                    side: 'RIGHT',
                    commit_id: commit.sha
                  })
                  rightLineNumber++
                } else if (line.startsWith('-')) {
                  core.debug(
                    `Posting review comment to ${file.filename} - LEFT - ${leftLineNumber}`
                  )
                  await octokit.rest.pulls.createReviewComment({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: context.payload.pull_request.number,
                    body: `Test - ${leftLineNumber} - LEFT - ${line}`,
                    path: file.filename,
                    line: leftLineNumber,
                    side: 'LEFT',
                    commit_id: commit.sha
                  })
                  leftLineNumber++
                } else {
                  leftLineNumber++
                  rightLineNumber++
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}

run()
