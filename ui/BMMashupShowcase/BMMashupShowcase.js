
var _BMMashupShowcaseCollectionView;
var _BMMashupShowcaseView;
var BMMashupShowcaseIsVisible = NO;


$(document).ready(function () {
	var navBarMenu = $(".navbar-static-top > .navbar-inner > ul.nav.pull-right");
	
	var showcaseButton = $('<li class="BMDebuggerButton"><div class="DebuggerIcon"></div>Mashup Overview <span class="BMDebuggerButtonKeyboardShortcut">&#8984;M</span></div>');
	
	navBarMenu.prepend(showcaseButton);
	
	showcaseButton.click(function (event) {
		BMMashupShowcaseEnter();
	});
});

function BMMashupShowcaseEnter() {
	BMMashupShowcaseIsVisible = YES;

	_BMMashupShowcaseView = $('<div class="BMMashupShowcaseView""></div>');
	$(document.body).append(_BMMashupShowcaseView);

	_BMMashupShowcaseView.click(function (event) {
		if (event.target != this && event.target.parentNode != this) return;

		this.style.pointerEvents = 'none';
		event.stopPropagation();
		event.preventDefault();

		BMMashupShowcaseExit();
	})

	_BMMashupShowcaseCollectionView = BMCollectionViewMakeWithContainer(_BMMashupShowcaseView, {customScroll: YES});

	var mashupCache = $(window).data('twMashupBuilder').mashupCache;
	var tabs = $('.tab-navigate-command');
	var mashups = [];
	var newMashups = [];
	var oldMashups = mashups;

	function mashupElementForTab(tab) {
		/*var sessionID = TW.IDE.RunningTabs[tab.attr('tab-id')].entityDetailSection.data('twMashupsDetail').sessionId;
		var cachedMashup = mashupCache[sessionID];

		if (cachedMashup) {
			var element = cachedMashup.workspaceEl;

			if (!element) return;

			return element.find('#mashup-root-bounding-box > .widget-content');
		}*/
	}
	
	var mashupsToLoad = 0;
	
	function mashupDefinitionForTab(tab, args) {
		var name = tab.attr('title');

		let xhr = new XMLHttpRequest();
		xhr.open('GET', '/Thingworx/Mashups/' + name, YES);
		xhr.setRequestHeader('Accept', 'application/json');

		xhr.onload = function () {
			if (!BMMashupShowcaseIsVisible) return;

			var result = JSON.parse(xhr.responseText);
	
			result._BMDeserializedContent = JSON.parse(result.mashupContent);

			args.withObject.definition = result;

			mashupsToLoad--;

			if (mashupsToLoad == 0) {
				_BMMashupShowcaseCollectionView.dataSet = mashupShowcaseDataSet;

				enableKeyboardShortcuts();
			}
		};

		xhr.send();
	}

	tabs.each((index, tab) => {
		tab = $(tab);

		if (tab.attr('tab-cmd').indexOf('/Mashups/') != -1) {
			mashupsToLoad++;
			var object = {
				tab: tab,
				mashupName: tab.attr('title')
			};
			mashupDefinitionForTab(tab, {withObject: object});
			mashups.push(object);
		}
	});

	var mashupShowcaseDataSet = {
		numberOfSections() { return 1 },
		numberOfObjectsInSectionAtIndex(i) { return mashups.length },
		indexPathForObjectAtRow(row, args) { return BMIndexPathMakeWithRow(row, {section: 0, forObject: mashups[row]}); },
		indexPathForObject(object) { return; }, // BMIndexPathMakeWithRow(mashups.indexOf(object), {section: 0, forObject: object}); },
		contentsForCellWithReuseIdentifier(identifier) {
			/*var node = mashups[identifier].mashupElement.clone();

			if (!parseInt(node.css('width')) || !parseInt(node.css('height'))) {
				node.css('width', '800px');
				node.css('height', '600px');
			}

			var width = parseInt(node.css('width'), 10);
			var height = parseInt(node.css('height'), 10);

			var scale = Math.min(256 / width, 256 / height);

			BMHook(node, {transformOriginX: '0%', transformOriginY: '0%', scaleX: scale, scaleY: scale});*/

			var content = $('<div class="automatically-resize-contents"></div>');

			content.css({
				position: 'absolute',
				left: '0px',
				top: '0px',
				width: mashups[identifier].definition._BMDeserializedContent.UI.Properties.Width + 'px',
				height: mashups[identifier].definition._BMDeserializedContent.UI.Properties.Height + 'px',
				overflow: 'hidden',
				background: 'white'
			})

			return content;
		},
		cellForItemAtIndexPath(indexPath) {
			return _BMMashupShowcaseCollectionView.dequeueCellForReuseIdentifier(indexPath.row);
		},
		updateCell(cell, args) {

		},
		destroy() {

			mashups = newMashups;
			_BMMashupShowcaseCollectionView.updateEntireDataAnimated(YES, {completionHandler: function () {
				_BMMashupShowcaseView.remove();
				oldMashups.forEach(function (mashup) {
					mashup.mashup.destroyMashup();
				});
			}});

		},
		useOldData(use) {
			mashups = use ? oldMashups : newMashups;
		},
		isUsingOldData() {
			return mashups == oldMashups;
		}
	};

	var columns = Math.ceil(Math.sqrt(mashups.length)) | 0;
	var rows = Math.ceil(mashups.length / columns) | 0;

	var sizeWidth = (window.innerWidth - 48 * (columns + 1)) / columns | 0;
	var sizeHeight = (window.innerHeight - 96 - 48 * rows) / rows | 0;

	_BMMashupShowcaseCollectionView.layout = new BMCollectionViewFlowLayout();
	_BMMashupShowcaseCollectionView.layout.cellSize = BMSizeMake(sizeWidth, sizeHeight);
	_BMMashupShowcaseCollectionView.layout.rowSpacing = 48;
	_BMMashupShowcaseCollectionView.layout.minimumSpacing = 48;
	_BMMashupShowcaseCollectionView.layout.sectionInsets = BMInsetMakeWithLeft(0, {top:48, right: 0, bottom: 48});

	_BMMashupShowcaseCollectionView.mashups = [];

	_BMMashupShowcaseCollectionView.delegate = {
		collectionViewShouldRunIntroAnimation() { return YES },
		collectionViewDidRenderCell(collectionView, cell, args) {
			var container = cell.element.find('.automatically-resize-contents');

			var scale = Math.min(cell.element.outerWidth() / container.outerWidth(), (cell.element.outerHeight() - 32) / container.outerHeight());

			var outerRect = BMRectMake(0, 32, cell.element.outerWidth(), cell.element.outerHeight() - 32);
			var innerRect = BMRectMake(0, 0, container.outerWidth(), container.outerHeight());

			var mashup = _BMMashupShowcaseRenderWithDefinition(cell.indexPath.object.definition, {inContainer: container, UUID: 'BMMashupShowcase' + cell.indexPath.object.mashupName});

			cell.indexPath.object.mashup = mashup;

			BMHook(container, {
				translateX: (-innerRect.center.x + outerRect.center.x) + 'px',
				translateY: (-innerRect.center.y + outerRect.center.y) + 'px',
				scaleX: scale,
				scaleY: scale
			});

			var textContent = $('<div class="BMMashupShowcaseTitle">' + (cell.indexPath.row + 1) + '. ' + cell.indexPath.object.definition.name + '</div>');
			cell.element.prepend(textContent);

			container.css({
				borderRadius: (5 * (1/scale)) + 'px',
				boxShadow: BMShadowForElevation(5 * (1/scale))
			});

			container.click(function () {
				BMMashupShowcaseExit();
				
				cell.indexPath.object.tab.click();
			});
		},
		collectionViewAnimationOptionsForIntroAnimation: function () {
			return {stride: 25, easing: 'easeOutExpo', duration: 400, delay: 100};
		},
		collectionViewInitialAttributesForPresentedCellAtIndexPath: function (collectionView, indexPath, args) {
			var attributes = args.withTargetAttributes;

			var windowRect = BMRectMake(0, 0, window.innerWidth, window.innerHeight);
			
			var slope = attributes.frame.center.slopeAngleToPoint(windowRect.center);
			var distance = -Math.abs(attributes.frame.center.distanceToPoint(windowRect.center));

			attributes.frame.offsetWithX(distance * 2 * Math.cos(slope), {y: distance * 2 * Math.sin(slope)});

			attributes.style.opacity = 0;
			attributes.style.scaleX = 3;
			attributes.style.scaleY = 3;

			return attributes;
		},
		collectionViewAnimationOptionsForUpdateAnimation: function () {
			return {stride: 25, easing: 'easeInExpo', duration: 400, delay: 200};
		},
		collectionViewFinalAttributesForDisappearingCellAtIndexPath: function (collectionView, indexPath, args) {
			var attributes = args.withTargetAttributes;

			var windowRect = BMRectMake(0, 0, window.innerWidth, window.innerHeight);
			
			var slope = attributes.frame.center.slopeAngleToPoint(windowRect.center);
			var distance = -Math.abs(attributes.frame.center.distanceToPoint(windowRect.center));

			attributes.frame.offsetWithX(distance * 2 * Math.cos(slope), {y: distance * 2 * Math.sin(slope)});

			attributes.style.opacity = 0;
			attributes.style.scaleX = 3;
			attributes.style.scaleY = 3;

			return attributes;
		}
	}

	_BMMashupShowcaseView.velocity({
		tween: 1
	}, {
		duration: 400,
		delay: 100,
		easing: 'easeOutExpo',
		progress: function (elements, progress) {
			_BMMashupShowcaseView[0].style.backgroundColor = 'rgba(0, 0, 0, ' + (progress / .75) + ')';
		}
	});

	function enableKeyboardShortcuts() {
		$(window).on('keydown.BMMashupShowcaseShortcuts', function (event) {
			var keyCode = event.which || event.keyCode;
			
			if (keyCode >= 48 && !event.ctrlKey && !event.metaKey && keyCode <= 57) {
				var number = keyCode - 49;
				if (number < 0) number = 9;

				if (mashups[number]) {
					mashups[number].tab.click();
					BMMashupShowcaseExit();
				}
			}
		});
	}
}

function BMMashupShowcaseExit() {

	$(window).off('keydown.BMMashupShowcaseShortcuts');
	
	_BMMashupShowcaseView.velocity({
		tween: 1
	}, {
		duration: 400,
		delay: 200,
		easing: 'easeInExpo',
		progress: function (elements, progress) {
			_BMMashupShowcaseView[0].style.backgroundColor = 'rgba(0, 0, 0, ' + ((1 - progress) / .75) + ')';
		}
	});

	_BMMashupShowcaseCollectionView.dataSet.destroy();

	BMMashupShowcaseIsVisible = NO;

}


$(window).on('keydown.BMMashupShowcase', function (event) {
	var keyCode = event.which || event.keyCode;
	
	if (keyCode == 77 && (event.ctrlKey || event.metaKey)) {
		BMMashupShowcaseEnter();
		
		event.stopPropagation();
		event.preventDefault();
	}
	
	if (keyCode == 83 && (event.ctrlKey || event.metaKey)) {
		var activeTab = $('.tab-panel-selected');
		var navbar = activeTab.find('.navbar');
		var saveButton = navbar.find('.btn-save-continue-edit.btn.btn-primary');

		if (saveButton.length) {
			saveButton.click();
		}
		
		event.stopPropagation();
		event.preventDefault();
	}
	
	if (keyCode == 27 && BMMashupShowcaseIsVisible) {
		BMMashupShowcaseExit();
		
		event.stopPropagation();
		event.preventDefault();
	}
});

/**
 * 
 * @param definition <Object>
 * {
 * 	@param inContainer <$>
 *  @param UUID <String>
 * }
 * @return <TWMashup>
 */
function _BMMashupShowcaseRenderWithDefinition(definition, args) {
	let contents = definition.mashupContent;
	let mashup = new TW.MashupDefinition({sessionID: ''});

	let container = args.inContainer;

	mashup.dataMgr = new DataManager();
	mashup.rootName = args.UUID;
	mashup.htmlIdOfMashup = '#' + args.UUID;

	let currentID = TW.Runtime.HtmlIdOfCurrentlyLoadedMashup;
	//let currentMashup = TW.Runtime.Workspace.Mashups.Current;
	TW.Runtime.HtmlIdOfCurrentlyLoadedMashup = mashup.htmlIdOfMashup;
	//TW.Runtime.Workspace.Mashups.Current = mashup;

	mashup.mashupName = definition.name;

	mashup.loadFromJSON(contents, definition);
	_BMFastIDEWidgetAppend.call(mashup.rootWidget, container, NO, 'BMMashupShowcase-' + args.UUID + '-');

	return mashup;

}

/**
 * Work in progress.
 * TODO trim the code
 * @param ui <$>
 * @param isCreatedFromUserDrop <Boolean>		Defaults to NO.
 */
function _BMFastIDEWidgetAppend (ui, isCreatedFromUserDrop, uuid) {
    var i = 0,
        contentElement,
        widgetProperties = this.allWidgetProperties(),
        thisPropertyId,
        widgetHtml,
        currentContainer,
        workspace = $('#workspace'),
        hasLabel = false,
		supportsAutoResize = widgetProperties.supportsAutoResize === true;

	var widgets = this.widgets;
		
	var properties = widgetProperties.properties;

    thisPropertyId = uuid + this.getProperty('Id');
    var widgetBoundingBox = $('<div id="' + thisPropertyId + '-bounding-box" class="widget-bounding-box" style="pointer-events: none; !important"><div class="widget-selection-box"></div></div>');
	ui.append(widgetBoundingBox);
	this.boundingBox = widgetBoundingBox;
    currentContainer = widgetBoundingBox;

    var isResponsive = false;
    if( (supportsAutoResize && ui.hasClass('automatically-resize-contents')) || this.widgetType() === 'layout' || this.widgetType() === 'flowlayout' || this.widgetType() === 'container' ) {
        isResponsive = true;
        this.properties.ResponsiveLayout = true;
    } else {
        this.properties.ResponsiveLayout = false;
    }
    if( widgetProperties.isContainer === true && widgetProperties.isContainerForOneResizeableWidget === true && isResponsive && widgets.length === 0 ) {
        widgetBoundingBox.addClass('no-widgets');
    }

    if( isResponsive ) { // && (logically) ui.properties.isContainerForOneResizeableWidget === true ) {
        widgetBoundingBox.addClass('responsive');
    } else {
        widgetBoundingBox.css('top', this.getProperty('Top') + 'px');
        widgetBoundingBox.css('left', this.getProperty('Left') + 'px');
    }
    widgetSelectionBox = widgetBoundingBox.children('.widget-selection-box').first();
    widgetBoundingBox.append('<div class="builder-widget-label" style="display:none;">' + (this.properties['Label'] === undefined ? '' : Encoder.htmlEncode(this.properties['Label'])) + '</div>');
    myLabel = widgetBoundingBox.find('.builder-widget-label').first();

    if (widgetProperties['supportsLabel'] === true && this.properties['Label'] !== undefined && this.properties['Label'].length > 0) {
        myLabel.show();
        widgetBoundingBox.addClass('label-added');
    } else {
        myLabel.hide();
        widgetBoundingBox.removeClass('label-added');
    }

    if (widgetProperties['isContainer'] === true) {
        if( widgetProperties['isDraggable'] && (!isResponsive) ) {
            widgetBoundingBox.append('<span class="tw-widget-container-drag-handle"></span>');
        }
        dragHandle = widgetBoundingBox.children().last();
        widgetBoundingBox.append('<div class="outer-container"></div>');
        currentContainer = ui.children().last();

        if (isCreatedFromUserDrop === true && this['afterCreate'] !== undefined) {
            try {
                this.afterCreate();
            }
            catch (err) {
                TW.log.error('An error occurred while calling ' + this.getProperty('Type') + '::afterRender(), Id = "' + this.getProperty('Id') + '", Mashup = "' + TW.IDE.Workspace.Mashups.CurrentName + '". ', err);
            }
        }

        try {
            widgetHtml = this.renderHtml();
        } catch (err) {
            TW.log.error('An error occurred while calling ' + this.getProperty('Type') + '::renderHtml(), Id = "' + this.getProperty('Id') + '", Mashup = "' + TW.IDE.Workspace.Mashups.CurrentName + '". ', err);
            if (widgetBoundingBox !== undefined && widgetBoundingBox.length > 0) {
                widgetBoundingBox.remove();
            }
            TW.IDE.showStatusText('error', 'Unable to create widget "' + this.getProperty('Type') + '". Please contact your widget developer.');
            return;
        }
        currentContainer.append(widgetHtml);
        contentElement = currentContainer.find('.widget-content').last();
        contentElement.attr('id', thisPropertyId);
        contentElement.attr('widget-type', properties['Type']);
    } else {

        try {
            widgetHtml = this.renderHtml();
        } catch (err) {
            TW.log.error('An error occurred while calling ' + this.getProperty('Type') + '::renderHtml(), Id = "' + this.getProperty('Id') + '", Mashup = "' + TW.IDE.Workspace.Mashups.CurrentName + '". ', err);
            if (widgetBoundingBox !== undefined && widgetBoundingBox.length > 0) {
                widgetBoundingBox.remove();
            }
            TW.IDE.showStatusText('error', 'Unable to create widget "' + this.getProperty('Type') + '". Please contact your widget developer.');
            return;
        }
        currentContainer.append(widgetHtml);
        contentElement = currentContainer.find('.widget-content').last();
        contentElement.attr('id', thisPropertyId);
        contentElement.attr('widget-type', properties['Type']);
    }

    this.domElementId = thisPropertyId;
    this.jqElementId = thisPropertyId;
    this.jqElement = $('#' + thisPropertyId);
    widgetElement = this.jqElement;
    // widgetBoundingBox.show();

    if (this['afterRender'] !== undefined) {
        try {
            this.afterRender();
        }
        catch (err) {
            TW.log.error('An error occurred while calling ' + this.getProperty('Type') + '::afterRender(), Id = "' + this.getProperty('Id') + '", Mashup = "' + TW.IDE.Workspace.Mashups.CurrentName + '". ', err);
        }
    }

    if (this.isResizable()) {
        contentElement.addClass('resizable');
    }

    //this.decorateWidget(widgetElement);

    var widgetsLength = widgets.length;
    var isContainerWithDeclarativeSpotsForSubWidgets = (this.allWidgetProperties().isContainerWithDeclarativeSpotsForSubWidgets === true);
    for (var i = 0; i < widgetsLength; i++) {
        if( isContainerWithDeclarativeSpotsForSubWidgets ) {
            // pjhtodo: consider doing this with id instead of attribute searching
			var spot = contentElement.find('[sub-widget-container-id="' + this.properties.Id + '"][sub-widget="' + (i+1) + '"]');
			_BMFastIDEWidgetAppend.call(widgets[i], spot, NO, uuid);
        } else {
			_BMFastIDEWidgetAppend.call(widgets[i], contentElement, NO, uuid);
        }
    }

    if (this.properties['Z-index'] !== undefined) {
        widgetBoundingBox.css('z-index', this.properties['Z-index'] + '');
    }

    var borderWidth = 0;
    if (widgetProperties['borderWidth'] !== undefined) {
        borderWidth = widgetProperties['borderWidth'] * 2;
        widgetBoundingBox.addClass('widget-with-border');
    }

    var isContainerWidget = false;
    if (this.getProperty('Type') === 'container') {
        isContainerWidget = true;
    }

    if (isResponsive )  {

    } else if( this.properties['Width'] !== undefined) {
        contentElement.css('width', (this.properties['Width'] - borderWidth).toString() + 'px');
        widgetSelectionBox.css('width', (this.properties['Width'] - borderWidth).toString() + 'px');
    }

    if (isResponsive )  {

    } else if( this.properties['Height'] !== undefined) {
        var widgetContentHeight = this.properties['Height'] - borderWidth,
            widgetSelectionHeight = widgetContentHeight;
        if (hasLabel) {
            widgetSelectionHeight += myLabel.outerHeight();
        }
        contentElement.css('height', widgetContentHeight + 'px');
    }

    contentElement.addClass('selectable');

    if (this['afterLayout'] !== undefined) {
        setTimeout(
            (function(widget, widgetId){
                return function() {
                        try {
                            widget.afterLayout();
                        } catch (err) {
                            TW.log.error('An error occurred while calling ' + widget.properties.Type + '::afterLayout, Id = "' + widgetId + '". ', err);
                        }
                };
        })(this, this.properties.Id), 100);
    }

    if (this['afterWidgetsRendered'] !== undefined) {
        try {
            this.afterWidgetsRendered();
        } catch (err) {
            TW.log.error('An error occurred while calling ' + this.properties.Type + '::afterWidgetsRendered, Id = "' + this.properties.Id + '". ', err);
        }
    }

    if( isResponsive ) {
        if( widgetProperties.properties['Top'] === undefined ) {
            widgetProperties.properties['Top'] = {};
        }
        if( widgetProperties.properties['Left'] === undefined ) {
            widgetProperties.properties['Left'] = {};
        }
        if( widgetProperties.properties['Width'] === undefined ) {
            widgetProperties.properties['Width'] = {};
        }
        if( widgetProperties.properties['Height'] === undefined ) {
            widgetProperties.properties['Height'] = {};
        }

        widgetProperties.properties['Top']['isVisible'] = false;
        widgetProperties.properties['Left']['isVisible'] = false;
        widgetProperties.properties['Width']['isVisible'] = false;
        widgetProperties.properties['Height']['isVisible'] = false;
        widgetProperties.isDraggable = false;
        widgetProperties.allowPositioning = false;
    }

    return;
};