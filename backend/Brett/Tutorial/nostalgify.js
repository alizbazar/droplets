var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var player = models.player;
var playlist = models.playlist;

var billboardApiKey="amctfu77bu7amyhqud9bfcqb";
var echonestApiKey="XO7WUUP32BZFOV4KR";

//last.fm
//Your API Key is 7211d25cfb4e693c7d7ed8815aec8f7d
var lastFmKey = "7211d25cfb4e693c7d7ed8815aec8f7d";
//Your secret is 1dd2ec920b3c42580b10547023a8c3e5
//http://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=b25b959554ed76058ac220b7b2e0a026&artist=Cher&album=Believe

var lastAlbum = "";

//TODO: get around this bogus global
var stopNow = false;

exports.init = init;

function init() 
{
	if (player.track == null) 
	{
		Song.innerText = "Nothing playing!";
	}
	else 
	{		
		stopNow = false;
		lastAlbum = player.track.album.name;
		console.log("albumName=" + player.track.album.name + " lastAlbum=" + lastAlbum);

		updateTrackDetails(player.track.data);
		searchWikiForAlbum(player.track.data);

//		getLastFmReleaseDate(player.track.data);
//		searchEchoNestForArtistInfo(player.track.data);
	}
	
	player.observe(models.EVENT.CHANGE, 
		function (e) 
		{

			// Only update the page if the track changed
			if (e.data.curtrack == true) 
			{							
				console.log("albumName=" + player.track.album.name + " lastAlbum=" + lastAlbum);

				//TODO:
				//assume there's something like (e.data.album.name == true) instead of manually tracking
				if(player.track.album.name != lastAlbum)
				{
					stopNow = false;
					console.log("updating");
					
					lastAlbum = player.track.album.name;
					
					updateTrackDetails(player.track.data);
					searchWikiForAlbum(player.track.data);

//					getLastFmReleaseDate(player.track.data);
//					searchEchoNestForArtistInfo(player.track.data);
				}
				else
				{
					console.log("SAME ALBUM, not updating");
				}
			}			
		}
	);
}

function updateTrackDetails(playerTrackData) 
{
	Song.innerText = playerTrackData.name.decodeForText();
	Album.innerText = playerTrackData.album.name.decodeForText();
	Artist.innerText = playerTrackData.album.artist.name.decodeForText();
	
	URI.innerText = playerTrackData.uri;
}

function searchWikiForAlbum(playerTrackData) 
{	
	Released.innerText = "";
	
	URI.innerText="";
	Song1.innerText="";
	Song2.innerText="";
	Song3.innerText="";
	Song4.innerText="";

	//var album = playerTrackData.album.name;
	requestPageIds(playerTrackData, false);			
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
    console.log("released.innertext=" + Released.innerText);
    if(Released.innerText === "" && stopNow === false)
    {
    	stopNow = true;
    	requestPageIds(player.track.data, true);			
   	}
    else if (normalizedDate !== undefined)
    {
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
	            		
	            		thisSong = buildSong(splitByComma[2]);
	            		//if(thisSong !== undefined)
	            		if(typeof thisSong !== 'undefined')
	            		{
	            			if(songs.indexOf(thisSong) != -1)
	            			{
	            				songs.push(thisSong);
	            			}
	            		}
	            		if(songs.length >= maxSongs)
	            		{
	            			break;
	            		}

	            		thisSong = buildSong(splitByComma[3]);
	            		if(typeof thisSong !== 'undefined')
	            		{
	            			if(songs.indexOf(thisSong) != -1)
	            			{
	            				songs.push(thisSong);
	            			}
	            		}
	           			songs.push(thisSong);
	            		
	            		if(songs.length >= maxSongs)
	            		{
	            			break;
	            		}
	            		
	            		thisSong = buildSong(splitByComma[4]);
	            		if(typeof thisSong !== 'undefined')
	            		{
	            			if(songs.indexOf(thisSong) != -1)
	            			{
	            				songs.push(thisSong);
	            			}
	            		}
	            		songs.push(thisSong);
	            		
	            		if(songs.length >= maxSongs)
	            		{
	            			break;
	            		}
	
	            		var lastSong = splitByComma[5].split(" href");
	           			
	            		var spacePos = lastSong[0].lastIndexOf(" ");
	            		tmpString = lastSong[0].substring(0,spacePos);
	
	            		thisSong = buildSong(tmpString);
	            		if(typeof thisSong !== 'undefined')
	            		{
	            			if(songs.indexOf(thisSong) != -1)
	            			{
	            				songs.push(thisSong);
	            			}
	            		}
	            		songs.push(thisSong);
	            		if(songs.length >= maxSongs)
	            		{
	            			break;
	            		}
            		}
            		catch(error)
            		{
            			
            		}
            	}
            }
            
            	Song1.innerText = songs[0].artist + ", " + songs[0].title;	
            	Song2.innerText = songs[1].artist + ", " + songs[1].title;
            	Song3.innerText = songs[2].artist + ", " + songs[2].title;
               	Song4.innerText = songs[3].artist + ", " + songs[3].title;
            
            for(var z = 0; z < songs.length; z++)
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





function requestTopTen(normalizedDate)
{
	//http://api.billboard.com/apisvc/chart/v1/list?artist=Jackson&sdate=2003-10-10&edate=2008-08-08&api_key=txkttmnu46cb7q62dh9fdbp7
	//	http://api.billboard.com/apisvc/chart/v1/list?song=One&api_key=txkttmnu46cb7q62dh9fdbp7
	
	var requestStr="http://api.billboard.com/apisvc/chart/v1/list?artist=Jackson&sdate=2003-10-10&edate=2008-08-08&api_key=" + billboardApiKey;
	
	var req = new XMLHttpRequest();
	req.open("GET", requestStr, true);
    req.onreadystatechange = function() 
    {
    	parseTopTenResults(req);
    };    
    req.send();

}


function searchEchoNestForArtistInfo(playerTrackData)
{
//	http://developer.echonest.com/api/v4/artist/biographies?api_key=N6E4NIOVYMTHNDM8J&id=ARH6W4X1187B99274F&format=json&results=1&start=0&license=cc-by-sa
//	http://developer.echonest.com/api/v4/artist/biographies?api_key=N6E4NIOVYMTHNDM8J&name=&format=json&results=1&start=0
	var artist = playerTrackData.album.artist.name.replace(" ", "+");
	
//		var requestStr = "http://developer.echonest.com/api/v4/artist/biographies?api_key="+echonestApiKey+"&id=ARH6W4X1187B99274F&format=json&results=1&start=0&license=cc-by-sa"
	var requestStr = "http://developer.echonest.com/api/v4/artist/biographies?api_key="+echonestApiKey+"&name="+artist+"&format=json&results=1&start=0";
	console.log("requesting echoNest data:" + requestStr);
		
	var req = new XMLHttpRequest();
	req.open("GET", requestStr, true);
	req.onreadystatechange = function() 
	{
		parseEchoNest(req);
	};    
	req.send();
}

function parseEchoNest(request)
{
    if (request.readyState == 4) 
    {
        if (request.status == 200) 
        {
        	console.log("echonest results" + request.responseText); 	
        }
        else
        {
        	console.log("echonest failure text:" + request.statusText);
        }
    }

}

function getLastFmReleaseDate(playerTrackData)
{
	//var artist = playerTrackData.album.artist.name.replace(" ", "+");
	var album = playerTrackData.album.name.decodeForText();
	var artist = playerTrackData.album.artist.name.decodeForText();
	
//		var requestStr = "http://developer.echonest.com/api/v4/artist/biographies?api_key="+echonestApiKey+"&id=ARH6W4X1187B99274F&format=json&results=1&start=0&license=cc-by-sa"
	var requestStr = "http://ws.audioscrobbler.com/2.0/?method=album.getinfo&format=json&api_key="+lastFmKey+"&artist="+artist+"&album="+album;

	console.log("requesting lastfm data:" + requestStr);
		
	var req = new XMLHttpRequest();
	req.open("GET", requestStr, true);
	req.onreadystatechange = function() 
	{
		parseLastFmReleaseDate(req);
	};    
	req.send();
}

function parseLastFmReleaseDate(request)
{
	console.log(request.responseText);
}


function parseTopTenResults(request)
{
//	console.log("Status=" + request.status);
    if (request.readyState == 4) 
    {
        if (request.status == 200) 
        {
        	console.log(request.responseText);
        }
    }
}





//function getReleaseDateWithRedirects(pageid)
//{
//	console.log("trying now with redirects");
//
//	var req = new XMLHttpRequest();
//	req.open("GET", "http://en.wikipedia.org/w/api.php?action=parse&format=xml&pageid="+pageid+"&redirects&prop=wikitext", true);
//	req.setRequestHeader("User-Agent", "MyAlbumReleaseDateSearcher/0.9");
//	req.onreadystatechange = function() 
//	{
//		console.log("Status=" + req.status);
//	    if (req.readyState == 4) 
//	    {
//	        if (req.status == 200) 
//	        {
//	        	if(!tryToPopulateReleaseDate(req.responseText))
//	        	{
//	        		console.log("didn't find even w redirects")
//		        	if(!stopNow)
//		        	{
//		        		stopNow = true;
//		        		console.log("last ditch adding (album) and starting over");
//		        		//One last try
//		        		var playerTrackInfo = player.track;
//		        		if (playerTrackInfo == null) 
//		        		{
//		        			header.innerText = "Nothing playing!";
//		        		} 
//		        		else 
//		        		{
//		        			var album = playerTrackInfo.data.album.name;
//			        		album += " (album)";
//			        		album.replace("&apos;", "'");
//		        			console.log("Sending album="+album);	        			
//		        			requestPageIds(album);		
//		        		}
//		        	}
//		        	else
//		        	{
//		        		console.log("stopping bc we've already tried appending album");
//		        	}
//	        	}
//	        }
//	    }
//	};	
//	req.send();
//}


//[[Category:1991 albums]]
//[[Category:Albums produced by Brian Eno]]
//[[Category:Albums produced by Daniel Lanois]]
//[[Category:Albums produced by Steve Lillywhite]]
//[[Category:English-language albums]]
//[[Category:Island Records albums]]
//[[Category:U2 albums]]

//{"query":
//{"pages":
//	{"209063":
//		{"pageid":209063,"ns":0,"title":"Achtung Baby","touched":"2012-02-20T12:32:25Z","lastrevid":475750055,"counter":"","length":105009
//		}
//	}
//}
//}
