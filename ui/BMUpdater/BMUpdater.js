
/**
 * A type representing an update that may be applied to an extension.
 */
function BMExtensionUpdate() {} // <constructor>

BMExtensionUpdate.prototype = {

	/**
	 * The package name of the extension.
	 */
	packageName: undefined, // <String>

	/**
	 * The current version.
	 */
	currentVersion: undefined, // <String>

	/**
	 * The new version.
	 */
	newVersion: undefined, // <String>

	/**
	 * A list of download URL for the extension packages.
	 */
	packages: undefined, // <[String]>

	/**
	 * The update's progress.
	 */
	_progress: 0, // <Number>

	/**
	 * Applies the extension update.
	 * @param handler <void ^ (), nullable>				An optional handler to invoke when the update has been applied.
	 * {
	 * 	@param progress <void ^ (nullable Number), nullable>		An optional handler that is periodically invoked to track this update's progress.
	 * 																The handler takes the completion percentage as its sole argument.
	 * 																If the percentage cannot be determined, the parameter will be undefined.
	 * }
	 * @return <Promise<Void>>										A promise that resolves when this operation completes.
	 */
	applyWithCompletionHandler: async function (handler, args) {
		let self = this;
		let updatesToApply = this.packages.length;

		let progressComponents = Array(updatesToApply * 2).map(_ => 0);

		// Updates the progress for this request.
		function updateProgress() {
			let progress = progressComponents.reduce((sum, value) => sum + value) / progressComponents.length;
			if (args && args.progress) args.progress(progress);
		}

		let blobs = [];

		// Load the packages that will be applied for this
		for (var i = 0; i < updatesToApply; i++) try {
			let blob = await BMGetContentsOfURL(this.packages[i], {
				progress: function (progress) {
					// If progress is undefined, this will cause an indeterminate progress bar until this request completes
					progressComponents[i] = progress;
					updateProgress();
				},
				completionHandler: function (blob, error) {
					progressComponents[i] = 1;
				}
			});
			blobs.push(blob);
		}
		catch (err) {
			// If an error occurs while trying to get the extension package, don't apply the update
		}

		for (let i = 0; i < blobs.length; i++) {
			await BMPackageApply(blobs[i], {progress(progress) {
				progressComponents[updatesToApply + i] = progress;
				updateProgress();
			}});
		}

	}

};

/**
 * Constructs, initializes and returns an extension update with the given properties.
 * @param packageName <String>					The extension's package name.
 * {
 * 	@param currentVersion <String>				The extension's current version.
 * 	@param newVersion <String>					The updated version.
 * 	@param packages <[String]>					An array containing the update packages that should be installed.
 * }
 */
BMExtensionUpdate.extensionUpdateWithPackageName = function (packageName, args) {
	let update = new BMExtensionUpdate();

	update.packageName = packageName;
	BMCopyProperties(update, args);

	return update;
};

/**
 * Attempts to retrieve the contents of the given URL. This will trigger an asynchronous request after which the supplied
 * completion handler will be invoked. If the content can be retrieved, it will be supplied to the completion handler as a Blob.
 * @param URL <String>														The URL from which to retrieve contents.
 * {
 * 	@param withMimeType <String, nullable>									Defaults to 'application/octet-stream'. The expected mime type of the content.
 * 	@param completionHandler <void ^(nullable Blob, nullable Error)>		A handler which will be invoked when the request finishes. This handler receives two parameters:
 * 																			 - The blob representing the contents of the given URL if it could be retrieved.
 * 																			 - An error describing what went wrong if it could not be retrieved.
 * 	@param progress <void ^(nullable Number), nullable>						If specified, this handler will be periodically invoked, receiving the completion
 * 																			percentage as its parameter. If the percentage cannot be determined, the parameter will be undefined.
 * }
 * @return <Promise<Blob>>													A promise that resolves when the request completes and fails if an error occurs.
 */
function BMGetContentsOfURL(URL, args) {
	return new Promise(function (resolve, reject) {
		let request = new XMLHttpRequest();
		request.open('GET', URL, YES);
	
		args.withMimeType = args.withMimeType || 'application/octet-stream';
	
		request.overrideMimeType(args.withMimeType);
		request.responseType = 'arraybuffer';
	
		request.onload = function () {
			if (args.progress) {
				args.progress(1);
			}
			if (this.status == 200) {
				args.completionHandler(this.response, undefined);
				resolve(this.response);
			}
			else {
				let error = new Error('The server replied with a status code of ' + this.status);
				args.completionHandler(undefined, error);
				reject(error);
			}
		}
	
		request.onerror = function (error) {
			args.completionHandler(undefined, error);
			reject(error);
		}
	
		if (args.progress) {
			request.addEventListener('progress', function (event) {
				if (event.lengthComputable) {
					args.progress(event.loaded / event.total);
				}
				else {
					args.progress(.5);
				}
			});
		}
	
		request.send();
	});
};

/**
 * Applies the given update package to the server in which the script is running.
 * @param package <Blob>						The package to apply.
 * {
 * 	@param progress <void ^(nullable Number)>	A callback that is repeatedly invoked while this request is in progress.
 * }
 * @return <Promise<Void>>						A promise that resolves when the operation completes.
 */
function BMPackageApply(package, args) {
	return new Promise(function (resolve, reject) {
		let xhr = new XMLHttpRequest();
		xhr.open('POST', '/Thingworx/ExtensionPackageUploader?purpose=import', YES);
		xhr.setRequestHeader('X-XSRF-TOKEN', 'TWX-XSRF-TOKEN-VALUE');

		let data = new FormData();
		data.append('file', new Blob([package], {type: 'application/octet-stream'}), 'Extensions.zip');

		xhr.onload = function () {
			if (args.progress) {
				args.progress(1);
			}

			if (this.status == 200) {
				resolve();
			}
			else {
				let error = new Error('Server replied with a status code of ' + this.status);
				// Sometimes, thingworx sends nice error messages
				if (this.responseText.charAt(0) == '{') try {
					let errorDetails = JSON.parse(this.responseText);

					let message = errorDetails.rows[0].validate.rows[0].extensionException;
					error.serverResponse = message;
				}
				catch (err) {
					// Default to the standard error message otherwise
					error.serverResponse = this.responseText;
				}
				else {
					error.serverResponse = this.responseText;
				}

				reject(error);
			}
		}

		if (args && args.progress) xhr.onprogress = function (progress) {
			if (progress.lengthComputable) {
				args.progress(progress.loaded / progress.total);
			}
			else {
				args.progress(.5);
			}
		}

		xhr.onerror = function (error) {
			reject(error);
		}

		xhr.send(data);
	});
}

/**
 * Should be invoked to check for updates.
 * This will trigger an asynchronous check for updates and return immediately.
 * The result of the update check will be passed to the supplied completion handler, or an error
 * detailing what went wrong if the check could not be completed.
 * @param handler <void ^(nullable [BMExtensionUpdate], nullable Error)>				
 * 											A handler to execute when the update check finishes.
 * 											This handler takes two parameters:
 * 												- The update list if it could be retrieved. If everything is up to date, this parameter's value will be an empty array.
 * 												- An error object describing what went wrong if the updates could not be retrieved.
 * @return <Promise<[BMExtensionUpdate]>>	A promise that resolves when the requests complete and fails if an error occurs.
 */
function BMCheckForUpdatesWithCompletionHandler(handler) {
	let supportedExtensions;
	let resolve, reject;
	let promise = new Promise(function ($1, $2) { resolve = $1; reject = $2; });

	// First retrieve the list of compatible extensions, then check for an update to each of them
	BMSupportedExtensionListGetWithCompletionHandler(function (extensions, error) {
		if (error) {
			reject(error);
			return handler && handler(undefined, error);
		}

		let updates = [];
		let updatesToCheck = extensions.length;

		function returnUpdates() {
			// Decrement the number of updates to check
			updatesToCheck--;

			// If there aren't any left, notify the completion handler
			if (!updatesToCheck) {
				handler && handler(updates, error);
				resolve(updates);
			}
		}

		extensions.forEach(function (extension) {
			let updaterURL = extension.updaterURL;

			let updaterRequest = new XMLHttpRequest();
			updaterRequest.open('POST', '/Thingworx/Resources/ContentLoaderFunctions/Services/GetJSON', YES);
			// updaterRequest.open('GET', updaterURL, YES);
			updaterRequest.setRequestHeader('X-XSRF-TOKEN', 'TWX-XSRF-TOKEN-VALUE');
			updaterRequest.setRequestHeader('Accept', 'application/json');
			updaterRequest.setRequestHeader('Content-Type', 'application/json');

			updaterRequest.onload = function () {
				let result;
				let requiresUpdate = NO;
				let newVersion;
				try {
					result = JSON.parse(updaterRequest.responseText);

					newVersion = result.tag_name;
					requiresUpdate = BMIsVersion(newVersion, {newerThanVersion: extension.packageVersion});
				}
				catch (error) {
					console.error('Unable to check for updates to extension ' + extension.name + '. ', error);
					returnUpdates();
					return;
				}

				if (requiresUpdate) {
					// Compile the list of packages
					let packages = [];
					result.assets.forEach((asset) => {packages.push(asset.browser_download_url)});
					// Then create the extension update
					updates.push(BMExtensionUpdate.extensionUpdateWithPackageName(extension.name, {currentVersion: extension.packageVersion, newVersion: newVersion, packages: packages}));
				}
				
				returnUpdates();
			};

			updaterRequest.onerror = function (error) {
				console.error('Unable to check for updates to extension ' + extension.name + '.');
			};

			updaterRequest.send(JSON.stringify({url: updaterURL}));
			// updaterRequest.send(JSON.stringify({url: updaterURL}));
		});
	});

	return promise;
}

/**
 * Compares whether an extension's current version is newer than another version.
 * @param version <String>					The new version.
 * {
 * 	@param newerThanVersion <String>		The current version.
 * }
 * @return <Boolean>						YES if the new version is newer, NO otherwise.
 */
function BMIsVersion(version, args) {
	// Split the current version into components
	let extensionVersionComponents = (args.newerThanVersion || '').split('.');

	let extensionVersionMajor = parseInt(extensionVersionComponents[0], 10) || 0;
	let extensionVersionMinor = parseInt(extensionVersionComponents[1], 10) || 0;
	let extensionVersionPatch = parseInt(extensionVersionComponents[2], 10) || 0;

	// Split the new version into components
	let newVersionComponents = (version || '').split('.');

	let newVersionMajor = parseInt(newVersionComponents[0], 10) || 0;
	let newVersionMinor = parseInt(newVersionComponents[1], 10) || 0;
	let newVersionPatch = parseInt(newVersionComponents[2], 10) || 0;

	// Then compare them component by component
	if (newVersionMajor > extensionVersionMajor) {
		return YES;
	}
	// The current version might be newer than the server version
	// (for example on development or testing environments)
	else if (newVersionMajor == extensionVersionMajor) {
		if (newVersionMinor > extensionVersionMinor) {
			return YES;
		}
		else if (newVersionMinor == extensionVersionMinor) {
			return newVersionPatch > extensionVersionPatch;
		}
		
	}

	return NO;
}

/**
 * Retrieves a list of updater-compatible extensions.
 * In order for an extension to be compatible with the updater, it must have the 
 * build number field set to a JSON object that contains the giteaURL property.
 * This will trigger an asynchronous request to the Thingworx server to retrieve the list of extensions and then return immediately.
 * @param handler <void ^(nullable [TWExtensionDefinition], nullable Error)>				
 * 											A handler to execute when the request to retrieve compatible extensions finishes.
 * 											This handler takes two parameters:
 * 												- The extension list if it could be retrieved.
 * 												- An error object describing what went wrong if the extension list could not be retrieved.
 * @return <Promise<[TWExtensionDefinition]>>	A promise that resolves if the operation completes successfully or rejects otherwise.
 */
function BMSupportedExtensionListGetWithCompletionHandler(handler) {
	return new Promise(function (resolve, reject) {
		let request = new XMLHttpRequest();
		request.open('POST', '/Thingworx/Subsystems/PlatformSubsystem/Services/GetExtensionPackageList/', YES);
		request.setRequestHeader('Accept', 'application/json');
		request.setRequestHeader('Content-Type', 'application/json');
	
		request.onload = function () {
			let result;
			try {
				result = JSON.parse(request.responseText);
			}
			catch (e) {
				handler(new Error("Unexpected response received from the server."));
				return handler(undefined, new Error("Unexpected response received from the server."));
			}
	
			let compatibleExtensions = [];
			result.rows.forEach(function (row) {
				try {
					if (row.buildNumber) {
						let updaterURL = JSON.parse(row.buildNumber).giteaURL;
	
						if (updaterURL) {
							row.updaterURL = updaterURL;
							compatibleExtensions.push(row);
						}
					}
				}
				catch (e) {
					// If the JSON parsing fails or any property is undefined, the extension is not compatible with the updater.
				}
			});
	
			handler(compatibleExtensions, undefined);
			resolve(compatibleExtensions);
		};
	
		request.onerror = function (error) {
			reject(error);
			return handler(undefined, new Error("Unexpected response received from the server."));
		};
	
		request.send('{}');
	});

}

let BMUpdaterCurrentUpdate;


(async function () {
	let updates = await BMCheckForUpdatesWithCompletionHandler();

	await new Promise(function (resolve) {
		setTimeout(function () {
			resolve();
		}, 5000);
	})

	if (updates.length) {
		let windowFrame = BMRectMake(0, 0, window.innerWidth, window.innerHeight);
		let frame = BMRectMake(0, 0, 480, 72 * 2 + 56 * updates.length);
		frame.size.height = Math.min(800, frame.size.height);
		frame.center = windowFrame.center;
		let popup = (new BMWindow()).initWithFrame(frame);

		let header = document.createElement('div');
		header.className = 'BMWindowTitle';
		header.innerText = 'Updates Available!';
		popup.toolbar.appendChild(header);

		popup.content.classList.add('BMUpdaterContent');
		
		let updatesNode = document.createElement('div');
		updatesNode.className = 'BMUpdaterList';
		popup.content.appendChild(updatesNode);

		let footer = document.createElement('div');
		footer.className = 'BMUpdaterFooter';
		popup.content.appendChild(footer);

		popup._window.style.backgroundColor = 'white';

		let installAll = document.createElement('button');
		installAll.className = 'BMWindowButton';
		installAll.innerText = 'Update All';
		installAll.style.paddingLeft = '8px';
		installAll.style.paddingRight = '8px';
		footer.appendChild(installAll);

		popup.bringToFrontAnimated(YES, {completionHandler() {
			let updatesCollection = BMCollectionViewMakeWithContainer($(updatesNode), {useCustomScroll: YES});
			updatesCollection.layout = new BMCollectionViewTableLayout();
			updatesCollection.layout.rowHeight = 56;

			updatesCollection.delegate = {
				collectionViewShouldRunIntroAnimation: () => YES
			}

			updatesCollection.dataSet = {
				numberOfSections: () => 1,
				numberOfObjectsInSectionAtIndex: (index) => updates.length,
				cellForItemAtIndexPath: (indexPath) => {
					cell = updatesCollection.dequeueCellForReuseIdentifier('Update');

					cell.node.style.display = 'flex';
					cell.node.style.paddingRight = '16px';
					cell.node.style.boxSizing = 'border-box';

					let name = document.createElement('div');
					name.className = 'BMWindowLabel';
					name.style.paddingLeft = '16px';
					name.innerText = updates[indexPath.row].packageName;
					
					let version = document.createElement('div');
					version.className = 'BMWindowLabel BMWindowSublabel BMWindowEllipsis';
					version.style.flexGrow = 1;
					version.innerText = '(' + updates[indexPath.row].currentVersion + ' ⇨ ' + updates[indexPath.row].newVersion + ')';

					let install = document.createElement('button');
					install.className = 'BMWindowButton BMWindowButtonWeak';
					install.innerText = 'Update';
					install.flexGrow = 0;
					install.flexShrink = 0;
					install.style.paddingLeft = '8px';
					install.style.paddingRight = '8px';
					install.style.marginLeft = '8px';
					install.style.marginRight = '8px';
					install.style.position = 'relative';

					let progress = document.createElement('div');
					progress.style.position = 'absolute';
					progress.style.left = '0px';
					progress.style.top = '0px';
					progress.style.height = '100%';
					progress.style.backgroundColor = 'rgba(0, 128, 255, .33)';
					install.appendChild(progress);

					let installing = NO;
					install.addEventListener('click', async function (event) {
						if (installing) return;
						installing = YES;

						await BMUpdaterCurrentUpdate;

						let resolve;
						BMUpdaterCurrentUpdate = new Promise(($0, $1) => resolve = $0);

						try {
							await updates[indexPath.row].applyWithCompletionHandler(function () {}, {progress: function (fraction) {
								$.Velocity(progress, 'stop');
								$.Velocity(progress, {width: fraction * 100 + '%'}, {queue: NO, duration: 100, easing: 'easeInOutQuad'});
								//progress.style.width = fraction * 100 + '%';
							}});

							install.style.borderColor = 'rgba(0, 200, 50, .5)';
							install.style.color = 'rgba(0, 200, 50, 1)';
							install.innerText = '✓ Installed';
						}
						catch (e) {
							install.style.borderColor = 'rgba(255, 0, 0, .5)';
							install.style.color = 'red';
							install.innerText = '✖ Error';
							install.classList.add('BMHasTooltip');
							//install.title = 'Check the application log for details.'
							install.setAttribute('data-bm-tooltip', e.serverResponse || e.message);

							progress.style.width = '0px';
						}

						resolve();
					});

					cell.node.appendChild(name);
					cell.node.appendChild(version);
					cell.node.appendChild(install);

					return cell;
				},
				contentsForCellWithReuseIdentifier: () => '',
				indexPathForObjectAtRow: (row) => BMIndexPathMakeWithRow(row, {section: 0, forObject: updates[row]}),
				indexPathForObject: (object) => BMIndexPathMakeWithRow(updates.indexOf(object), {section: 0, forObject: object})
			}

			// Load and retain all cells
			updates.forEach(function (update, index) {
				updatesCollection.retainCellForIndexPath(BMIndexPathMakeWithRow(index, {section: 0, forObject: update}));
			});

			installAll.addEventListener('click', function (event) {
				updatesCollection.enumerateAllCellsWithBlock(function (cell) {
					cell.node.querySelectorAll('button')[0].click();
				})
			});

		}});

		let resizeCallback = function (event) {
			let windowFrame = BMRectMake(0, 0, window.innerWidth, window.innerHeight);
			frame.center = windowFrame.center;
			popup.frame = frame;
		};

		window.addEventListener('resize', resizeCallback);

		popup.delegate = {
			windowWillClose() {
				window.removeEventListener('resize', resizeCallback);
			}
		};

	}
})();