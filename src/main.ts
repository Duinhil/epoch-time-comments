import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    core.debug('Started run')
    const githubToken = core.getInput('GITHUB_TOKEN')

    const octokit = github.getOctokit(githubToken)
    const context = github.context
    if (context.payload.pull_request) {
      const files = await octokit.paginate(
        octokit.rest.pulls.listFiles,
        {
          owner: context.repo.owner,
          repo: context.repo.repo,
          pull_number: context.payload.pull_request.number
        },
        response => response.data
      )
      const commits = await octokit.rest.pulls.listCommits({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: context.payload.pull_request.number
      })

      const latestCommitSHA = commits.data[0].sha
      core.debug(latestCommitSHA)
      for await (const file of files) {
        const lines = file.patch?.split(/\r\n|\r|\n/)
        if (lines) {
          let leftLineNumber = 0
          let rightLineNumber = 0
          for (const line of lines) {
            core.debug(line)
            const lineNumbers = line.match(/@@ -(\d+),\d+ \+(\d+),\d+ @@/)
            if (lineNumbers) {
              core.debug(JSON.stringify(lineNumbers))
              leftLineNumber = parseInt(lineNumbers[1])
              rightLineNumber = parseInt(lineNumbers[2])
            } else if (line.startsWith('+')) {
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
                commit_id: latestCommitSHA
              })
              leftLineNumber++
            } else if (line.startsWith('-')) {
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
                commit_id: latestCommitSHA
              })
              rightLineNumber++
            } else {
              leftLineNumber++
              rightLineNumber++
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
