var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var player = models.player;

var ECHO_NEST_KEY =  'EOGLVCKR6RT6NR3DK';

exports.init = init;

function init() {

    updatePageWithTrackDetails();

    player.observe(models.EVENT.CHANGE, function (e) {

        // Only update the page if the track changed
        if (e.data.curtrack == true) {
            updatePageWithTrackDetails();
        }
    });
}

function updatePageWithTrackDetails() {

    var header = document.getElementById("header");

    // This will be null if nothing is playing.
    var playerTrackInfo = player.track;

    if (playerTrackInfo == null) {
        $("#track").text("Nothing playing!");
    } else {
        var track = playerTrackInfo.data;
		
		queryNewsForArtist(track.album.artist.name);
    }
	
	queryWikipediaForFilmsInYear('1984');
}

function createDrop(title, url, imgurl) {
	var html = "<div class='drop'>"
	html = html + "<img src='" + imgurl + "' />"
	html = html + "<p>" + title + "</p>"
	html = html + "</div>"
	
	$("#drops").append(html);
	$(".drop:last").click( function() {
		//something here
	});
}

function queryWikipediaForFilmsInYear(year) {
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
				var patt=/==Top\sgrossing\sfilms\s\(U\.S\.\)==[\s\S^]*?==/g;
				var topGrossing = wikiText.match(patt)[0];
				
				patt=/\|\s\d\.\s\|[\s\S]*?\|-/g;
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
					'format': 'json'
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
					$("#news" + i).text(news[i].name);
				}
			});
	}
}
