# SignPath Github Actions

This repository contains the Github Actions that can be used to submit a signing request to [SignPath.io](https://about.signpath.io).

> [!WARNING]
> These actions are currently in development and only available in preview mode for selected customers. Contact [support@signpath.io](mailto:support@signpath.io) if you are interested in using them.

Currently, there is only one action available, `submit-signing-request`.

## submit-signing-request

This action allows you to sign the build artifact using SignPath signing services.

See [action.yml](actions/submit-signing-request/action.yml)

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
        artifact-name: '<Name of the Github Actions artifact>'
        github-token: '${{ secrets.GITHUB_TOKEN }}'
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
        artifact-name: '<Name of the artifact to sign>'
        github-token: '${{ secrets.GITHUB_TOKEN }}'
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