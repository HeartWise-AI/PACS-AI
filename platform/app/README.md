## PACS AI OHIF Viewer

Based on https://github.com/OHIF/Viewers (v3.7.0)

### Setup

_Requirements:_

- https://github.com/nvm-sh/nvm (recommended so you can switch Node versions effortlessly)
- `nvm install 18.13.0`
- `nvm use 18.13.0`
- To check version, `node --version`

### Developing Locally

In your cloned repository's root folder, run:

```js
// necessary yarn step
yarn config set workspaces-experimental true

// Restore dependencies
yarn install

// Stands up local server to host Viewer.
// Viewer connects to our public cloud PACS by default
yarn start

// for staging data, visit the following tenant
http://localhost:3000/login?t=qhn-mha-nzjew

```

### E2E Tests

Using [Cypress](https://www.cypress.io/) to create End-to-End tests and check
whether the application flow is performing correctly, ensuring that the
integrated components are working as expected.

#### Why Cypress?

Cypress is a next generation front end testing tool built for the modern web.
With Cypress is easy to set up, write, run and debug tests

It allow us to write different types of tests:

- End-to-End tests
- Integration tests
- Unit tets

All tests must be in `./cypress/integration` folder.

Commands to run the tests:

```js
// Open Cypress Dashboard that provides insight into what happened when your tests ran
yarn run cy

// Run all tests using Electron browser headless
yarn run cy:run

// Run all tests in CI mode
yarn run cy:run:ci
```

Maintainers: Karl from Nuxify, Dan from Nuxify
