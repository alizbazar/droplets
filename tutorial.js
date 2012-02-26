var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var player = models.player;

var ECHO_NEST_KEY =  'EOGLVCKR6RT6NR3DK';
var EMBEDLY_KEY = '9ab6f030604011e1ae744040d3dc5c07';

var totalDrops = 0;

var dropsMade = 0;

var stopNow = false;

exports.init = init;

function init() {

    player.observe(models.EVENT.CHANGE, function (e) {

        // Only update the page if the track changed
        if (e.data.curtrack == true) {
			$("#startPage").hide();
			$("#right").show();
            updatePageWithTrackDetails();
        }
    });
    $('#sink').on('click', 'a.addDrop', function(e) {
        $(this).closest('.drop').toggleClass('selected');
		if ($(this).closest('.drop').hasClass('selected')) {
			totalDrops++;
		} else {
			totalDrops--;
		}
		$("#totalDrops").text(totalDrops);
        e.preventDefault();
    });
}

function updatePageWithTrackDetails() {

	$("#pipe1").empty();
	$("#pipe2").empty();
	$("#pipe3").empty();

    var header = document.getElementById("header");

    // This will be null if nothing is playing.
    var playerTrackInfo = player.track;

    if (playerTrackInfo == null) {
        $("#track").text("Nothing playing!");
    } else {
        var track = playerTrackInfo.data;
		
		$("#current_track").text(track.name.decodeForText());
		
		requestPageIds(player.track.data, false);
		queryNewsForArtist(track.album.artist.name);
		runProductSearch(track);
    }
}

function createDrop(title, url, imgurl, service) {
	var idnum = (dropsMade % 3) + 1;
	dropsMade++;
	var pipeid = 'pipe' + idnum;
	
	var html = "<div class='drop'>";
	
	if (service) {
		if (service == 'spotify') {
			html += "<a href='" + url + "'>"
		}
		
		html += "<img class='serviceurl' id='" + service + "img' src='" + service + ".png' />";
	}
	
	if (imgurl) {
		html += "<img class='imgurl' src='" + imgurl + "' />";
	}
	
	if (service == "spotify") {
		html += "</a>"
	}
	
    html += "<p>" + title + "</p>"
	     + '<a href="#" class="addDrop"><span class="add_drop_icon sprite"></span></a>'
	     + "</div>";
	
	if (service != 'echonest') {
		$("#" + pipeid).prepend(html);
		$(".drop:first").click( function() {
			//something here
		});
	} else {
		$("#" + pipeid).append(html);
		$(".drop:last").click( function() {
			//something here
		});
	}
}

function runProductSearch(track) {
	$.getJSON('http://sandbox.thinglink.com:8080/thinglink/action/amazonProductSearch', {query: track.artists[0].name}, function(data) {
		for(var i in data) {
			console.log(data);
			var title = data[i].text,
				link = data[i].url,
				icon = data[i].icon.replace("SL75", "SL300");
				
			createDrop(title, link, icon, 'amazon');
		}
	});
}

function queryWikipediaForFilmsInYear(normalizedDate) {
	var year = normalizedDate.toString('yyyy');

	var titles = year + ' in film';
	$.getJSON("http://en.wikipedia.org/w/api.php?",
		{
			'action': 'query',
			'titles': titles,
			'prop': 'info',
			'indexpageids': 'True',
			'format': 'json'
		},
        function(data){
			grabFilmsFromPageID(data.query.pageids[0]);
        });

	function grabFilmsFromPageID(pageid) {
		$.getJSON("http://en.wikipedia.org/w/api.php?",
			{
				'action': 'parse',
				'prop': 'wikitext',
				'pageid': pageid,
				'format': 'json'
			},
			function(data){
				var wikiText = data.parse.wikitext["*"];
				var patt=/grossing\sfilms[\s\S]*?==[\s\S^]*?==/g;
				var topGrossing = wikiText.match(patt)[0];
				
				patt=/\|[\s]*\d[\s\S]*?\|-/g;
				var movies = topGrossing.match(patt);
				
				for(var i = 0; i < 5; i++) {
					patt=/\[\[.*?\]\]/g;
					var movieTitle = movies[i].match(patt)[0];
					
					var moviePage;
					var stopChar = movieTitle.indexOf('|');
					if (stopChar > -1) {
						moviePage = movieTitle.substring(2,stopChar);
					} else {
						moviePage = movieTitle.substring(2,movieTitle.length-2);
					}
					
					$("#film" + i).text(moviePage);
					
					createDropForMoviePage(moviePage);
				}
			});
		
		function createDropForMoviePage(moviePage) {
			$.getJSON("http://api.embed.ly/1/oembed?",
				{
					'url': 'http://en.wikipedia.org/wiki/' + moviePage,
					'format': 'json',
					'key': EMBEDLY_KEY
				},
				function(data){
					createDrop(moviePage, data.url, data.thumbnail_url);
				});
		}
	}
}

function queryNewsForArtist(artist) {
	$.getJSON("http://developer.echonest.com/api/v4/artist/search?",
		{
			'api_key': ECHO_NEST_KEY,
			'format': 'json',
			'results': 1,
			'name': artist
		},
		function(data){
			getNewsForArtistID(data.response.artists[0].id);
		});
	
	function getNewsForArtistID(artistID) {
		$.getJSON("http://developer.echonest.com/api/v4/artist/news?",
			{
				'api_key': ECHO_NEST_KEY,
				'id': artistID,
				'format': 'json',
				'results': 5,
				'start': 0
			},
			function(data){
				var news = data.response.news;
			
				for (var i = 0; i < 5; i++) {
					createDrop(news[i].name, news[i].url, null, 'echonest');
				}
			});
	}
}

function requestPageIds(playerTrackData, plusAlbum)
{
	var albumName=playerTrackData.album.name.decodeForText();
	
	//TODO: oh god no!
	albumName = normalizeName(albumName);
	
	if(plusAlbum === true)
	{
		albumName = albumName + " (album)";
	}
	console.log("requesting page title: " + albumName);

	var requestString = "http://en.wikipedia.org/w/api.php?action=query&titles=" + albumName + "&prop=info&indexpageids&format=json";	
	console.log("request: " + requestString);
	
	var req = new XMLHttpRequest();
	req.open("GET", requestString, true);
	req.setRequestHeader("User-Agent", "MyAlbumReleaseDateSearcher/0.9");
    req.onreadystatechange = function() 
    {
    	getPageIdsCallback(req);
    };
    req.send();
}

function normalizeName(name)
{
	name = name.replace(" And", " and");
	return name;
}

function getPageIdsCallback(request)
{
    if (request.readyState == 4) 
    {
        if (request.status == 200) 
        {
        	console.log("page id result =" + request.responseText);
        	var pageIdArray = parseJsonForPageIds(request.responseText);

        	console.log("got "+pageIdArray.length + " pageids");            	
        	
    		for(var j=0; j < pageIdArray.length; j++)
    		{
    			if(pageIdArray[j] > 0)
    			{
        			console.log("trying to get release date from " + pageIdArray[j]);
        			getReleaseDate(pageIdArray[j], false);
    			}
    		}
        }
    }
}

function parseJsonForPageIds(jsonText)
{
	//Get json pages, iterate first 3 looking for artist name inside
	var resultDetails = eval('(' + jsonText + ')');

	//Here we should return an array of max n pageids,
	//and calling function should retrieve each page, looking for a reference to the artist playing,
	//then use that pageid to continue
	var maxResults = 3;
	var myPageIds=new Array(maxResults);
	var pageIds = resultDetails.query["pageids"];
	if(pageIds.length > 0)
	{
		for(var i=0; i < pageIds.length && i < maxResults; i++)
		{
			myPageIds[i] = pageIds[i];
		}	
	}
	return pageIds;
}

function getReleaseDate(pageid, inclRedirects)
{
	//var requestStr = "http://en.wikipedia.org/w/api.php?action=parse&format=xml&pageid="+pageid;
	var requestStr = "http://en.wikipedia.org/w/api.php?action=parse&format=json&pageid="+pageid;
	if(inclRedirects == true)
	{
		requestStr += "&redirects";
	}
	requestStr += "&prop=wikitext";

	console.log("request string:" + requestStr);
	
	var req = new XMLHttpRequest();
	req.open("GET", requestStr, true);
	req.setRequestHeader("User-Agent", "MyAlbumReleaseDateSearcher/0.9");
	req.onreadystatechange = function() 
	{
		parseReleaseDateCallback(req);
	};
	req.send();
}

function parseReleaseDateCallback(request)
{
    if (request.readyState == 4) 
    {
        if (request.status == 200) 
        {
        	console.log("trying to pop release date");
        	tryToPopulateReleaseDate(request.responseText);
        }
    }
}

function tryToPopulateReleaseDate(wikiText)
{
    //TODO: parse responseText by breaking into [pipe+space] delimited tokens, 
    //look for "Recorded", then stop and get the date.
    var pipeSections = wikiText.split("|");
    var section;
    var numLines = pipeSections.length;
    var normalizedDate;
	var foundDate = false;
    
    for (var i = 0; i < numLines; i++) 
    {
    	section = pipeSections[i];
    	if(section.indexOf("Released ") != -1)
    	{
    		console.log("found release date: " + section);

    		//TODO: remove extra stuff and normalize date info from section text
    		normalizedDate = normalizeDate(section);
    		foundDate = true;   		
    	}
    }
    //console.log("released.innertext=" + Released.innerText);
    if(foundDate === false && stopNow === false)
    {
    	stopNow = true;
    	requestPageIds(player.track.data, true);			
   	}
    else if (normalizedDate !== undefined)
    {
		queryWikipediaForFilmsInYear(normalizedDate);
    	getTopFourPage(normalizedDate);
    }
    
}

function normalizeDate(sectionText)
{
	//strip trailing \n and get rid of Released =. Date can manage extra white space apparently
	var normalStr = sectionText.replace("\\n", "");
	normalStr = normalStr.replace("Released", "");
	normalStr = normalStr.replace("=", "");
	
	var splitStrings = normalStr.split("<");
	normalStr = splitStrings[0];
	
	splitStrings = normalStr.split(";");
	normalStr = splitStrings[0];
		
	normalStr = normalStr.trim();
	
	console.log("trying to parse:" + normalStr);
	var date = Date.parse(normalStr);
	console.log("date obj:" + date);
	return date;
}

//August 1988; Reaching Number 18
////Released    = March 9, 2010
////Released	= 14 March 1988
////Released  = {{Start date|1991|11|19|df=y}}
////Released	= 1988
////Released	= November 1988
////Released	= August 1988; Reaching Number 18    		
////Released	= March 1968<ref>{{cite web...    		

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getTopFourPage(date)
{
	console.log("top four" + date.toString());
	var decade = date.toString('yy');
	var dec = decade.charAt(0);
	console.log("decade digit:" + dec);
	
	var requestStr = "http://tunecaster.com/chart" + dec + ".html";
	//http://tunecaster.com/chart6.html
	
	var req = new XMLHttpRequest();
	req.open("GET", requestStr, true);
    req.onreadystatechange = function() 
    {
    	getTopFourList(req, date);
    };
    req.send();

}

function getTopFourList(request, date)
{
    if (request.readyState == 4) 
    {
        if (request.status == 200) 
        {
//        	console.log("about to parse top four page");
//        	grabTopFourFromPage(request.responseText, date);
        	
        	console.log("Month = " + date.getMonthName());

        	var month = date.getMonthName();
        	var year = date.toString('yyyy');
        	
        	var divSections = request.responseText.split("<div");
            var section;
            var numLines = divSections.length;
            var songs = new Array();
            var thisSong;
            var tmpString;
            
            //console.log("split into line count=" + numLines);
            var songIdx = -1;
            var splitStringOffset = 2
            var maxSongs = 4;
            
            for (var i = 0; i < numLines; i++) 
            {
            	section = divSections[i];
            	
            	if(section.indexOf(month) != -1 && section.indexOf(year) != -1)
            	{
            		try
            		{
	            		var splitByComma = section.split(",");

	            		for(var j=0; j < maxSongs-1; j++)
	            		{
		            		thisSong = buildSong(splitByComma[splitStringOffset]);
		            		if(typeof thisSong !== 'undefined')
		            		{
		            			songIdx++;
		            			songs[songIdx] = thisSong;
		            		}
		            		if(songs.length >= maxSongs)
		            		{
		            			break;
		            		}
		            		splitStringOffset++;
	            		}
	            			
	            		var lastSong = splitByComma[splitStringOffset].split(" href");
	           			
	            		var spacePos = lastSong[0].lastIndexOf(" ");
	            		tmpString = lastSong[0].substring(0,spacePos);
	
	            		thisSong = buildSong(tmpString);
	            		if(typeof thisSong !== 'undefined')
	            		{
	            			songIdx++;
	            			songs[songIdx] = thisSong;
	            		}
	            		if(songs.length >= maxSongs)
	            		{
	            			break;
	            		}
            		}
            		catch(error)
            		{
            			console.log("error adding songs:" + error);
            		}
            	}
            }
            
            for(var z = 0; z <= songIdx; z++)
            {
            	getURI(songs[z]);
            }            
            
        }
    }
}

function getURI(song)
{

    var searchStr = "track:\"" + song.title + "\" AND artist:\""+song.artist + "\"";

    var search = new models.Search(searchStr);
    search.searchTracks = true;    
    search.searchAlbums = false;
    search.searchArtists = false;
    search.pageSize = 1;
    
    search.observe(models.EVENT.CHANGE, function() {
    	for(var i in search.tracks) 
    	{
			createDrop(song.title + " by " + song.artist, search.tracks[i].uri, search.tracks[i].image, 'spotify');
    		$('#Song5 a').attr('href', search.tracks[i].image);
    		console.log("trackname:"+search.tracks[i].name.decodeForText()+ "uri:"+search.tracks[i].uri);
    		console.log("imageuri:"+search.tracks[i].image);
        }
    });
    search.appendNext();
}

function buildSong(songString)
{
	//console.log("starting with:" + songString);
	//" 2. I'll Always Love You by Taylor Dayne"
	var s = songString.split(". ");
	var s2 = s[1].split(" by ");
	
	var songObj = { "title": s2[0], "artist": s2[1] };
	
	if(s2[0] !== undefined && s2[1] !== undefined)
	{
		console.log("created song:" + songObj.artist + ":" + songObj.title);
	}
	else
	{
		console.log("undefined result from:" + songString);
		songObj = null;
	}
	return songObj;
}