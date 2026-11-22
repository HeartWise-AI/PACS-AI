# Build-time CA certificates

Put PEM certificates named `*.crt` here when the build must trust an extra CA
(for example a TLS-inspecting proxy). `Dockerfile.pacs-ai` copies this
directory into the builder stage and runs `update-ca-certificates`. Everything
in this directory except this file is git-ignored.
