# SignPath Github Actions

This repository contains the Github Action `submit-signing-request` that can be used to submit a signing request to [SignPath.io](https://about.signpath.io).

> [!WARNING]
> This action is currently in development and only available in preview mode for selected customers. Contact [support@signpath.io](mailto:support@signpath.io) if you are interested in using it.

## submit-signing-request

This action allows you to sign the build artifact using SignPath signing services.

For a definition of the parameters, see [action.yml](actions/submit-signing-request/action.yml)

### Action parameters
* `connector-url` (optional): The URL of the SignPath connector. Defaults to `https://githubactions.connectors.signpath.io`
* `api-token` (required): The SignPath REST API access token. Read more in the [SignPath documentation](https://about.signpath.io/documentation/build-system-integration#authentication)
* `organization-id` (required): SignPath organization ID
* `project-slug` (required): SignPath project slug
* `signing-policy-slug` (required): SignPath signing policy slug
* `artifact-configuration-slug` (required): SignPath artifact configuration slug
* `github-artifact-name` (required): Name of the Github Actions artifact
* `github-token` (optional): GitHub access token used to read job details and download the artifact. Defaults to the [`secrets.GITHUB_TOKEN`](https://docs.github.com/en/actions/security-guides/automatic-token-authentication). Requires the `action:read` and `content:read` permissions. _Note: This token will be stored (encrypted) on SignPath.io._
* `github-extended-verification-token` (optional): Token used to query the runners API. Only required if larger runners are used. Requires the `organization_self_hosted_runners:read` permission.
* `wait-for-completion-timeout-in-seconds` (optional): Maximum time in seconds that the action will wait for the signing request to complete. Defaults to 10 minutes.
* `service-unavailable-timeout-in-seconds` (optional): Total time in seconds that the action will wait for a single service call to succeed (across several retries). Defaults to 10 minutes.
* `download-signed-artifact-timeout-in-seconds` (optional): HTTP timeout when downloading the signed artifact. Defaults to 5 minutes.
* `wait-for-completion` (optional): If true, the action will wait for the signing request to complete. Defaults to `true`.
* `output-artifact-directory` (optional): Path where the signed artifact will be saved. If not specified, the task will not download the signed artifact from SignPath.

### Prerequisites

* The Github Actions Trusted Build System must be enabled in the organization and linked to the respective project.
* The artifact must be uploaded to the Github Actions workflow using the [actions/upload-artifact](https://github.com/actions/upload-artifact) action before it can be signed. 
* The `secrets.SIGNPATH_API_TOKEN` variable must belong to a user who has a submitter role in the referenced signing policy

### Samples

#### Sign published artifact and download the signed artifact back to the build agent file system

```yaml
steps:
- id: optional_step_id
  uses: signpath/github-actions/actions/submit-signing-request@v0.1
      with:
        api-token: '${{ secrets.SIGNPATH_API_TOKEN }}'
        organization-id: '<SignPath organization id>'
        project-slug: '<SignPath project slug>'
        signing-policy-slug: '<SignPath signing policy slug>'
        artifact-configuration-slug: '<SignPath artifact configuration slug>'
        github-artifact-name: '<Name of the Github Actions artifact>'
        wait-for-completion: true
        output-artifact-directory: '<Destination path for the signed artifact>'
```

#### Sign published artifact and continue workflow execution (do not download the signed artifact)

```yaml
steps:
- id: optional_step_id
  uses: signpath/github-actions/actions/submit-signing-request@v0.1
      with:
        api-token: '${{ secrets.SIGNPATH_API_TOKEN }}'
        organization-id: '<SignPath organization id>'
        project-slug: '<SignPath project slug>'
        signing-policy-slug: '<SignPath policy slug>'
        artifact-configuration-slug: '<SignPath artifact configuration slug>'
        github-artifact-name: '<Name of the artifact to sign>'
        wait-for-completion: false
```

#### Use output parameters

The `submit-signing-request` action supports the following output parameters:
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