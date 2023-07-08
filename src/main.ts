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
      for await (const file of files) {
        const lines = file.patch?.split(/\r\n|\r|\n/)
        if (lines) {
          let leftLineNumber = 0
          let rightLineNumber = 0
          for (const line of lines) {
            const lineNumbers = line.match(/@@ -(\d+),\d+ \+(\d+),\d+ @@/)
            if (lineNumbers) {
              leftLineNumber = parseInt(lineNumbers[0])
              rightLineNumber = parseInt(lineNumbers[1])
            } else if (line.startsWith('+')) {
              rightLineNumber++
              await octokit.rest.pulls.createReviewComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.payload.pull_request.number,
                body: `Test - ${line}`,
                path: file.filename,
                line: rightLineNumber,
                side: 'RIGHT'
              })
            } else if (line.startsWith('-')) {
              leftLineNumber++
              await octokit.rest.pulls.createReviewComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.payload.pull_request.number,
                body: `Test - ${line}`,
                path: file.filename,
                line: leftLineNumber,
                side: 'LEFT'
              })
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
