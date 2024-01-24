# SignPath Github Actions

This repository contains the Github Actions that can be used to submit a signing request to [SignPath.io](https://about.signpath.io).

> [!WARNING]
> These actions are currently in development and only available in preview mode for selected customers. Contact [support@signpath.io](mailto:support@signpath.io) if you are interested in using them.

Currently, there is only one action available, `submit-signing-request`.

## submit-signing-request

This action allows you to sign the build artifact using SignPath signing services.

For a definition of the parameters, see [action.yml](actions/submit-signing-request/action.yml)

### Permissions for the `github-token`

The action requires the provided `github-token` to have the following permissions:

* `actions:read`
* `content:read` 

The [default `secrets.GITHUB_TOKEN`](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token) already includes these permissions.

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
        github-token: '${{ secrets.GITHUB_TOKEN }}'
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
        github-token: '${{ secrets.GITHUB_TOKEN }}'
```

#### Timeout configuration
The following parameters can be used to specify the different available timeouts:
- `wait-for-completion-timeout-in-seconds`: Maximum time in seconds that the action will wait for the signing request to complete. Defaults to 600 seconds.
- `service-unavailable-timeout-in-seconds`: Total time in seconds that the action will wait for a single service call to succeed. Defaults to 600 seconds.
- `download-signed-artifact-timeout-in-seconds`: HTTP timeout when downloading the signed artifact. Defaults to 300 seconds.

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