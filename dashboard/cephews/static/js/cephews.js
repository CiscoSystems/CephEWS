/*
 * Copyright 2015 Cisco Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

/*
 * ----------------------------------- Common ----------------------------------
 */
$("#checkall").click(function(event) {
    if(this.checked) {
        $('table :checkbox').each(function() {
            this.checked = true;
        });
    } else {
        $('table :checkbox').each(function() {
            this.checked = false;
        });
    }
});
/*
 * ---------------------------------- Overview ---------------------------------
 */
var gauge = function(container, configuration) {
	var that = {};
	var config = {
		size						: 200,
		clipWidth					: 200,
		clipHeight					: 110,
		ringInset					: 20,
		ringWidth					: 20,
		
		pointerWidth				: 10,
		pointerTailLength			: 5,
		pointerHeadLengthPercent	: 0.9,
		
		minValue					: 0,
		maxValue					: 10,
		
		minAngle					: -90,
		maxAngle					: 90,
		
		transitionMs				: 750,
		
		majorTicks					: 3,
		labelFormat					: d3.format(',s'),
		labelInset					: 10,
		
		arcColorFn					: d3.interpolateHsl(d3.rgb('#e8e2ca'), d3.rgb('#3e6c0a'))
	};
	var range = undefined;
	var r = undefined;
	var pointerHeadLength = undefined;
	var value = 0;
	var svg = undefined;
	var arc = undefined;
	var scale = undefined;
	var ticks = undefined;
	var tickData = undefined;
	var pointer = undefined;

	var donut = d3.layout.pie();
	
	function deg2rad(deg) {
		return deg * Math.PI / 180;
	}
	
	function newAngle(d) {
		var ratio = scale(d);
		var newAngle = config.minAngle + (ratio * range);
		return newAngle;
	}
	
	function configure(configuration) {
		var prop = undefined;
		for ( prop in configuration ) {
			config[prop] = configuration[prop];
		}
		
		range = config.maxAngle - config.minAngle;
		r = config.size / 2;
		pointerHeadLength = Math.round(r * config.pointerHeadLengthPercent);

		// a linear scale that maps domain values to a percent from 0..1
		scale = d3.scale.linear()
			.range([0,1])
			.domain([config.minValue, config.maxValue]);
			
		ticks = scale.ticks(config.majorTicks);
		tickData = d3.range(config.majorTicks).map(function() {return 1/config.majorTicks;});
		
		arc = d3.svg.arc()
			.innerRadius(r - config.ringWidth - config.ringInset)
			.outerRadius(r - config.ringInset)
			.startAngle(function(d, i) {
				var ratio = d * i;
				return deg2rad(config.minAngle + (ratio * range));
			})
			.endAngle(function(d, i) {
				var ratio = d * (i+1);
				return deg2rad(config.minAngle + (ratio * range));
			});
	}
	that.configure = configure;
	
	function centerTranslation() {
		return 'translate('+r +','+ r +')';
	}
	
	function isRendered() {
		return (svg !== undefined);
	}
	that.isRendered = isRendered;
	
	function render(newValue) {
		svg = d3.select(container)
			.append('svg:svg')
				.attr('class', 'gauge')
				.attr('width', config.clipWidth)
				.attr('height', config.clipHeight);
		
		var centerTx = centerTranslation();
		
		var arcs = svg.append('g')
				.attr('class', 'arc')
				.attr('transform', centerTx);
		
		arcs.selectAll('path')
				.data(tickData)
			.enter().append('path')
				.attr('fill', function(d, i) {
					return ['#96bc23','#dea82c','#e92213'][i];
				})
				.attr('d', arc);
		
		var lg = svg.append('g')
				.attr('class', 'label')
				.attr('transform', centerTx);
		ticks.push(config.maxValue);
		lg.selectAll('text')
				.data(ticks)
			.enter().append('text')
				.attr('transform', function(d) {
					var ratio = scale(d);
					var newAngle = config.minAngle + (ratio * range);
					return 'rotate(' +newAngle +') translate(0,' +(config.labelInset - r) +')';
				})
				.text(function(d) { 
      var si = d3.format('.1f');
	        return String(si(d/1000000000)+"GB");});       
 
		var lineData = [ [config.pointerWidth / 2, 0], 
						[0, -pointerHeadLength],
						[-(config.pointerWidth / 2), 0],
						[0, config.pointerTailLength],
						[config.pointerWidth / 2, 0] ];
		var pointerLine = d3.svg.line().interpolate('monotone');
		var pg = svg.append('g').data([lineData])
				.attr('class', 'pointer')
				.attr('transform', centerTx);
				
		pointer = pg.append('path')
			.attr('d', pointerLine/*function(d) { return pointerLine(d) +'Z';}*/ )
			.attr('transform', 'rotate(' +config.minAngle +')');
			
		update(newValue === undefined ? 0 : newValue);
	}
	that.render = render;
	
	function update(newValue, newConfiguration) {
		if ( newConfiguration  !== undefined) {
			configure(newConfiguration);
		}
		var ratio = scale(newValue);
		var newAngle = config.minAngle + (ratio * range);
		pointer.transition()
			.duration(config.transitionMs)
			.ease('elastic')
			.attr('transform', 'rotate(' +newAngle +')');
	}
	that.update = update;

	configure(configuration);
	
	return that;
};

var overview_chart = function() {
    ctypes = $("form.chart-series input:checkbox");
    req = [];
    for(i=0;i<ctypes.length;i++)
        if(ctypes[i].checked)
            req.push(ctypes[i].value);
    var url = "json?m=overview&name="+jQuery("form.chart-series select").val()+"&stats=" + req.join(',')

    d3.json(url, function(error, poolData) {
        nv.addGraph(function() {
          var chart = nv.models.lineWithFocusChart();

          chart.xAxis
            .tickFormat(function(d){return d3.time.format('%H:%M')(new Date(d * 1000));});

          chart.x2Axis
            .tickFormat(function(d){return d3.time.format('%H:%M')(new Date(d * 1000));});

          chart.yAxis
            .tickFormat(d3.format('d'));

          chart.y2Axis
            .tickFormat(d3.format('d'));

          var nData = poolData[0].values.length;
          var brushStart = nData > 30 ? poolData[0].values[nData-30].x : poolData[0].values[0].x;
          var brushEnd = poolData[0].values[nData-1].x;
          chart.brushExtent([brushStart, brushEnd]);

          d3.select('#pool-status svg')
            .datum(poolData)
            .transition().duration(500)
            .call(chart)
            ;

          nv.utils.windowResize(chart.update);

          return chart;
        });
    });
}


/*
 * ------------------------------ OSD Status -----------------------------------
 */

var osd_tree = function(error, treeData) {
    // Calculate total nodes, max label length
    var totalNodes = 0;
    var maxLabelLength = 0;
    // Misc. variables
    var i = 0;
    var duration = 750;
    var root;

    // size of the diagram
    var viewerWidth = 800;
    //var viewerHeight = $('.tab-content').height();
    var viewerHeight = 600;

    var current_osd = null;

    var tree = d3.layout.tree()
        .size([viewerHeight, viewerWidth]);

    // define a d3 diagonal projection for use by the node paths later on.
    var diagonal = d3.svg.diagonal()
        .projection(function(d) {
            return [d.y, d.x];
        });

    // A recursive helper function for performing some setup by walking through all nodes

    function visit(parent, visitFn, childrenFn) {
        if (!parent) return;

        visitFn(parent);

        var children = childrenFn(parent);
        if (children) {
            var count = children.length;
            for (var i = 0; i < count; i++) {
                visit(children[i], visitFn, childrenFn);
            }
        }
    }

    // Call visit function to establish maxLabelLength
    visit(treeData, function(d) {
        totalNodes++;
        maxLabelLength = Math.max(d.name.length, maxLabelLength);
    }, function(d) {
        return d.children && d.children.length > 0 ? d.children : null;
    });


    // sort the tree according to the node names

    function sortTree() {
        tree.sort(function(a, b) {
            return b.name.toLowerCase() < a.name.toLowerCase() ? 1 : -1;
        });
    }
    // Sort the tree initially incase the JSON isn't in a sorted order.
    sortTree();

    // Define the zoom function for the zoomable tree
    function zoom() {
        $('svg .osd').popover('hide')
        svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }

    // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);

    // define the baseSvg, attaching a class for styling and the zoomListener
    var baseSvg = d3.select("#tree-container").append("svg")
        .attr("width", viewerWidth)
        .attr("height", viewerHeight)
        .attr("class", "overlay")
        .call(zoomListener);

    // Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.

    function centerNode(source) {
        scale = zoomListener.scale();
        x = -source.y0;
        y = -source.x0;
        x = x * scale + viewerWidth / 2 ;
        y = y * scale + viewerHeight / 2;
        d3.select('g').transition()
            .duration(duration)
            .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
        zoomListener.scale(scale);
        zoomListener.translate([x, y]);
    }

    // Toggle children function

    function toggleChildren(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else if (d._children) {
            d.children = d._children;
            d._children = null;
        }
        return d;
    }

    function osdPopover(id, title, load, mem, disk) {
        $('#osd'+id).popover('show');

        $(".osdpopovertitle").html(title)

        var text = "Load:";
        for(var i=0;i<3;i++)
            text += "<span class='label label-info'>" + load[i] + "</span>";
        $(".osdpopoverright").html(text);

        text = "Disk: " + disk['val'] + " / " + disk['total']
                   + "<div class='progress'><div class='progress-bar' role='progressbar' aria-valuenow='"
                   + disk['percent'] + "' aria-valuemin='0' aria-valuemax='100' style='width: "
                   + disk['percent'] + "%;'><span class='sr-only'>"
                   + disk['percent'] + "% Complete</span></div></div>";
        text += "Mem: " + mem['val'] + " / " + mem['total']
                + "<div class='progress'><div class='progress-bar' role='progressbar' aria-valuenow='"
                + mem['percent'] + "' aria-valuemin='0' aria-valuemax='100' style='width: "
                + mem['percent'] + "%;'><span class='sr-only'>"
                + mem['percent'] + "% Complete</span></div></div>";
        $(".osdpopover").html(text);
    }

    function clickOsd(d) {
        // Close popover window.
        if(current_osd == d.cid) {
                current_osd = null
                $('#osd'+d.cid).popover('hide');
                return;
        }

        // Hide previous window.
        $('#osd'+current_osd).popover('hide');

        current_osd = d.cid;
        var title = "Data Not Available"
            ,diskpercent = 0
            ,diskval = '-'
            ,disktotal = '-'
            ,mempercent = 0
            ,memval = '-'
            ,memtotal = '-';
        var load = ['-', '-', '-'];

        if (d.status == "up") {
            var hostname = d.parent.name;
            var url = "json?m=osd_info&host=" + hostname + "&id=" + d.cid;

            // Request OSD and host status.
            $.ajax(url).done(function(x){
                title = d.name;
                var content = x;
                for(i=0;i<3;i++)
                    load[i] = parseFloat(content['load'][i]);

                content['disk']['used'] = parseFloat(content['disk']['used'])
                content['disk']['free'] = parseFloat(content['disk']['free'])
                content['disk']['total'] = content['disk']['used'] + content['disk']['free'];
                diskpercent = (content['disk']['used'] / content['disk']['total']) * 100
                diskval = formatSizeUnits(content['disk']['used'])
                disktotal = formatSizeUnits(content['disk']['total'])

                content['memory']['used'] = parseInt(content['memory']['used']);
                content['memory']['free'] = parseInt(content['memory']['free']);
                content['memory']['total'] = content['memory']['used'] + content['memory']['free'];
                mempercent = (content['memory']['used'] / content['memory']['total']) * 100
                memval = formatSizeUnits(content['memory']['used'])
                memtotal = formatSizeUnits(content['memory']['total'])
                osdPopover(d.cid, title, load,
                           {val: memval, total: memtotal, percent: mempercent},
                           {val: diskval, total: disktotal, percent: diskpercent});
            })
        }else
            osdPopover(d.cid, title, load
                       ,{val: memval, total: memtotal, percent: mempercent}
                       ,{val: diskval, total: disktotal, percent: diskpercent});
    }

    // Toggle children on click.
    function click(d) {
        if (d3.event.defaultPrevented) return; // click suppressed

        if(d.type == 'osd') {
            clickOsd(d);
            return;
        }

        d = toggleChildren(d);
        update(d);
        centerNode(d);
    }

    function getClassForPercentage(percent) {
        if (percent < 60) {return "success"}
        else if (percent < 85) {return "warning"}
        else {return "danger"}
    }

    function formatSizeUnits(bytes){
      if      (bytes>=1073741824) {bytes=(bytes/1073741824).toFixed(2)+' GB';}
      else if (bytes>=1048576)    {bytes=(bytes/1048576).toFixed(2)+' MB';}
      else if (bytes>=1024)       {bytes=(bytes/1024).toFixed(2)+' KB';}
      else if (bytes>1)           {bytes=bytes+' bytes';}
      else if (bytes==1)          {bytes=bytes+' byte';}
      else                        {bytes='0 byte';}
      return bytes;
    }

    function update(source) {
        // Compute the new height, function counts total children of root node and sets tree height accordingly.
        // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
        // This makes the layout more consistent.
        var levelWidth = [1];
        var childCount = function(level, n) {

            if (n.children && n.children.length > 0) {
                if (levelWidth.length <= level + 1) levelWidth.push(0);

                levelWidth[level + 1] += n.children.length;
                n.children.forEach(function(d) {
                    childCount(level + 1, d);
                });
            }
        };
        childCount(0, root);
        var newHeight = d3.max(levelWidth) * 45; // 25 pixels per line
        tree = tree.size([newHeight, viewerWidth]);


        // Compute the new tree layout.
        var nodes = tree.nodes(root).reverse(),
            links = tree.links(nodes);

        // Set widths between levels based on maxLabelLength.
        nodes.forEach(function(d) {
            d.y = (d.depth * (maxLabelLength * 10)); //maxLabelLength * 10px
            // alternatively to keep a fixed scale one can set a fixed depth per level
            // Normalize for fixed-depth by commenting out below line
            // d.y = (d.depth * 500); //500px per level.
        });

        // Update the nodes…
        node = svgGroup.selectAll("g.node")
            .data(nodes, function(d) {
                return d.id || (d.id = ++i);
            });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("g")
            .attr("class", function(d) {return d.type_id == 0 ? "node osdNode" + d.cid : "node" })
            .attr("transform", function(d) {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            })
            .on('click', click);

        nodeEnter.append('path')
        nodeEnter.append('path')
        nodeEnter.append("circle")
            .attr('id', function(d) {return 'osd'+d.cid})
            .attr('class', function(d) { if (d.type_id == 0) {return 'nodeCircle osd'} else {return "nodeCircle"}  })
            .attr("r", 0)
            .style("fill", function(d) {
                if(d.type_id == 0)
                    return "lightsteelblue";
                return d._children ? "lightsteelblue" : "#fff";
            });

        nodeEnter.append("text")
            .attr("x", function(d) {
                return d.children || d._children ? -10 : 10;
            })
            .attr("dy", ".35em")
            .attr('class', 'nodeText')
            .attr("text-anchor", function(d) {
                return d.children || d._children ? "end" : "start";
            })
            .text(function(d) {
                return d.name;
            })
            .style("fill-opacity", 0);

        // Update the text to reflect whether node has children or not.
        node.select('text')
            .attr("x", function(d) {
                return d.children || d._children ? -10 : 10;
            })
            .attr("text-anchor", function(d) {
                return d.children || d._children ? "end" : "start";
            })
            .text(function(d) {
                return d.name;
            });

        // Change the circle fill depending on whether it has children and is collapsed
        node.select("circle.nodeCircle")
            .attr("r", 10)
            .style("fill", function(d) {
                return d._children ? "lightsteelblue" : "#fff";
            })
           .style("stroke", function(d){
                if (d.type_id == 0) {
                    if (d.status == "up") {
                        if (d.reweight > 0) { return '#5cb85c'}
                        else {return '#f0ad4e'}
                    }
                    else {
                        if (d.reweight > 0) { return '#b228C7';}
                        else {return '#d9534f'}
                    }
                }
                else {return "steelblue"}
            });

        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + d.y + "," + d.x + ")";
            });

        // Fade the text in
        nodeUpdate.select("text")
            .style("fill-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + source.y + "," + source.x + ")";
            })
            .remove();

        nodeExit.select("circle")
            .attr("r", 0);

        nodeExit.select("text")
            .style("fill-opacity", 0);

        // Update the links…
        var link = svgGroup.selectAll("path.link")
            .data(links, function(d) {
                return d.target.id;
            });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", function(d) {
                var o = {
                    x: source.x0,
                    y: source.y0
                };
                return diagonal({
                    source: o,
                    target: o
                });
            });

        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function(d) {
                var o = {
                    x: source.x,
                    y: source.y
                };
                return diagonal({
                    source: o,
                    target: o
                });
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
        //osdNode = svgGroup.selectAll("g.osdNode");
        $('svg .osd').popover({
            'placement' : 'right',
            'trigger' : 'manual',
            'html' : true,
            'title' : "<div class='osdpopoverright' style='float: right'></div><div class='osdpopovertitle'></div>",
            'content': "<div class='osdpopover' style='width:245px;height:130px;'></div>",
            'container': $('#tree-container')
        })
        //Generate IO heatmap
        //pullIo();
    }

    // Append a group which holds all nodes and which the zoom Listener can act upon.
    svgGroup = baseSvg.append("g");

    // Define the root
    root = treeData;
    root.x0 = viewerHeight / 2;
    root.y0 = viewerWidth / 2;

    // Layout the tree initially and center on the root node.
    update(root);
    centerNode(root);

    legendGroup = baseSvg.append("g");
    legends = ['bucket', 'up/in', 'up/out', 'down/in', 'down/out'];
    var legendColor = ["steelblue",'#5cb85c', '#f0ad4e', '#b228C7', '#d9534f']
    var legendWidth = 60;
    var legend = legendGroup.selectAll('.legend')
        .data(legends)
        .enter()
        .append('g')
        .attr('class','legend')
        .attr('transform', function(d, i) {
            return 'translate(' + i * legendWidth + ',0)';
        });

    legend.append("circle")
        .attr("r", 5)
        .style("fill", "#fff")
        .style("stroke", function(d,i){ return legendColor[i];});
    legend.append('text')
        .attr('x', 10)
        .attr('y', 3)
        .text(function(d) { return d;});

    legendGroup.transition()
        .duration(duration)
        .attr("transform", "translate("+ (viewerWidth-legendWidth*legends.length) + ",10)");
};

/*
var drawHeatmap = function(osd, pieData, heatData) {
    var color = d3.scale.linear().domain([0, 2000]).range(['white', 'red']);
    var osdGroup = svgGroup.select('g.osdNode' + osd);
    var pie = d3.layout.pie().sort(null);
    var arc = d3.svg.arc().innerRadius(10).outerRadius(15);

    var allZero = true;
    for(var i=0;i<pieData.length;i++)
        if(pieData[i]){
            allZero = false;
            break;
        }

    if(allZero)
        osdGroup.selectAll('path').style('file-opacity', 0);
    else
        osdGroup.selectAll('path')
            .data(pie(pieData))
            .style('fill', function(d,i) {return i==0 ? '#00EC00' : '#2894FF';})
            .style('fill-opacity', 1)
            .attr('d', arc);
    osdGroup.select('circle').style('fill', color(heatData))
}

var pullIo = function(){
    var url = "json?m=osd_io";
    $.ajax(url).done(function(data){
        for(var i=0;i<data.length;i++){
            drawHeatmap(data[i].id, [data[i].r, data[i].w], data[i].r + data[i].w);
        }
    });
}
*/
