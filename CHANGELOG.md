# 1.1.2

Added support for specifying a `gitHubURL` in the package build number. This has precedence over the old `giteaURL` but is otherwise identical.

When the update information contains a link to the update notes, a `Release Notes` button will appear to link to that URL.

# 1.1.1

The updater can now also update itself.

# 1.1

Resolved an issue in which applying updates would fail because they were imported in parallel.

Updates are now applied serially.

# 1.0.70

Initial release.