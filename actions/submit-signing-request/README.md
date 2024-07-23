# SignPath `github-action-submit-signing-request`

This repository contains the Github Action `submit-signing-request` that can be used to submit a signing request to [SignPath.io](https://about.signpath.io).

> [!WARNING]
> This action is currently in development and only available in preview for selected customers. Contact [support@signpath.io](mailto:support@signpath.io) if you are interested in using it.

## Prerequisite

The _Github Actions Trusted Build System_ must be enabled in the organization and linked to the respective project. See the respective [SignPath documentation](https://about.signpath.io/redirects/connectors/trusted-build-system-configuration). Note that the used artifact configuration must have a `zip-file` element at its root, as all artifacts are packaged as ZIP archives on GitHub by default.

## Action parameters

| Parameter                                     | Required           | Description |
| ----                                          | -                  | ------      |
| `connector-url`                               | -                  | The URL of the SignPath connector. Required if self-hosted.
| `api-token`                                   | :heavy_check_mark: | The SignPath REST API access token. Read more in the [SignPath documentation](https://about.signpath.io/redirects/connectors/api-token). Requires submitter permissions in the specified project/signing policy.
| `organization-id`                             | :heavy_check_mark: | The SignPath organization ID.
| `project-slug`                                | :heavy_check_mark: | The SignPath project slug.
| `signing-policy-slug`                         | :heavy_check_mark: | The SignPath signing policy slug.
| `artifact-configuration-slug`                 | -                  | The SignPath artifact configuration slug. If not specified, the default is used.
| `github-artifact-id`                          | :heavy_check_mark: | Id of the Github Actions artifact. Must be uploaded using the [actions/upload-artifact](https://github.com/actions/upload-artifact) v4+ action before it can be signed. Use `{{ steps.<step-id>.outputs.artifact-id }}` from the preceding actions/upload-artifact action step.
| `wait-for-completion`                         | -                  | If true, the action will wait for the signing request to complete. Defaults to `true`.
| `output-artifact-directory`                   | -                  | Path to where the signed artifact will be extracted. If not specified, the task will not download the signed artifact from SignPath.
| `github-token`                                | -                  | GitHub access token used to read job details and download the artifact. Defaults to the [`secrets.GITHUB_TOKEN`](https://docs.github.com/en/actions/security-guides/automatic-token-authentication). See [Token permissions] section below.
| `github-extended-verification-token`          | -                  | Optional separate token for advanced
| `wait-for-completion-timeout-in-seconds`      | -                  | Maximum time in seconds that the action will wait for the signing request to complete. Defaults to 10 minutes.
| `service-unavailable-timeout-in-seconds`      | -                  | Total time in seconds that the action will wait for a single service call to succeed (across several retries). Defaults to 10 minutes.
| `download-signed-artifact-timeout-in-seconds` | -                  | HTTP timeout when downloading the signed artifact. Defaults to 5 minutes.
| `parameters`                                  | -                  | Multiline-string of values that map to user-defined parameters in the Artifact Configuration. Use one line per parameter with the format `<name>: "<value>"` where `<value>` needs to be a valid JSON string.

See also [action.yml](action.yml)

### Token permissions

#### Basic validation
SignPath performs a basic set of checks to verify that the signed artifact was built from the expected repository and then downloads the artifact for further processing. For these checks, the `github-token` is used. This token will be stored (encrypted) on SignPath.io, and should be short-lived with minimal permissions. It is recommended to use the default `secrets.GITHUB_TOKEN` (default).

The permissions of the `secrets.GITHUB_TOKEN` are set to `permissive` (default) or `restricted` in the repository, organization or enterprise. See the [GitHub documentation](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token) for more details. In the latter case, the `action.read` and `content:read` permissions need to be explicitly set in the workflow definition for the respective job using the following snippet:

```yaml
jobs:
  my_job:
    permissions:
      content: read
      action: read
```

#### Extended validation

> [!INFO]
> This feature is currently only available for selected Enterprise customers. Contact [support@signpath.io](mailto:support@signpath.io) if you are interested in using it.

SignPath can perform additional validations to ensure the security of the build pipeline. For these validations, further read permissions are required. A token with the respective permissions can either be passed to the `github-token` parameter or to a separate `github-extended-verification-token` parameter. The latter is only used temporarily and will not be stored on SignPath.io.

The following validations are currently supported:

##### Runner validations

Restricts all workflow jobs leading to the signed artifact to run on runners from a defined set of runner groups.

##### Branch ruleset validations

Ensure that certain branch rules are enforced on GitHub.

* Requires the token to have repository metadata read permissions.
* Possibility to limit bypassers of the rules
* Ensure that the rules have been enforced continously from a specified date. _Note: Full functionality only available for GitHub Enterprise subscriptions. Requires the token to have the "Get the audit log for an enterprise" permission._

The following [branch ruleset rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) are currently supported:

* Restrict creations
* Restrict updates
* Restrict deletions:
* Require linear history
* Require signed commits
* Block force pushes
* Require code scanning results (with configurable security alerts and alerts threshold for each tool)

## Samples

### Sign published artifact and download the signed artifact back to the build agent file system

```yaml
steps:
- id: optional_step_id
  uses: signpath/github-action-submit-signing-request@v0.4
      with:
        api-token: '${{ secrets.SIGNPATH_API_TOKEN }}'
        organization-id: '<SignPath organization id>'
        project-slug: '<SignPath project slug>'
        signing-policy-slug: '<SignPath signing policy slug>'
        github-artifact-id: '${{steps.<upload-artifact-step-id>.outputs.artifact-id}}'
        wait-for-completion: true
        output-artifact-directory: '<Destination path for the signed artifact>'
        parameters: |
          Version: ${{ toJSON(vars.version) }}
          Release_Tag: "v1.0"
```

### Sign published artifact and continue workflow execution (do not download the signed artifact)

```yaml
steps:
- id: optional_step_id
  uses: signpath/github-action-submit-signing-request@v0.4
      with:
        api-token: '${{ secrets.SIGNPATH_API_TOKEN }}'
        organization-id: '<SignPath organization id>'
        project-slug: '<SignPath project slug>'
        signing-policy-slug: '<SignPath policy slug>'
        github-artifact-id: '${{steps.<upload-artifact-step-id>.outputs.artifact-id}}'
        wait-for-completion: false
```

### Use output parameters

The action supports the following output parameters:
- `signing-request-id`: The id of the newly created signing request
- `signing-request-web-url`: The url of the signing request in SignPath
- `signpath-api-url`: The base API url of the SignPath API
- `signed-artifact-download-url`: The url of the signed artifact in SignPath

You can use the output parameters in the following way:
```yaml
    steps:
    - name: Print the signing request id
      run:  echo "Output [${{steps.<submit_signing_request_step_id>.outputs.signing-request-id }}]"
```
