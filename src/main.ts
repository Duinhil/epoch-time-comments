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
        core.debug(`${file.filename} - ${file.patch}`)
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}

run()
