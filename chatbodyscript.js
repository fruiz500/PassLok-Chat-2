//gets chat type and kicks out those whose URL does not conform
window.onload = function() {
	if (!chatToken.includes('#') || !chatToken.includes('?')) {
		document.getElementById('session-start').innerHTML = '<span style="color:red">This page runs only from a PassLok chat invitation</span>';
		throw('attempted to run without referral')
	}
	if(chatType == 'A'){				//pre-fill chat type selectors according to URL
		dataChat.checked = true;
		audioChat.checked = false;
		videoChat.checked = false;
		jitsiChat.checked = false
	}else if(chatType == 'B'){
		dataChat.checked = false;
		audioChat.checked = true;
		videoChat.checked = false;
		jitsiChat.checked = false
	}else if(chatType == 'C'){
		dataChat.checked = false;
		audioChat.checked = false;
		videoChat.checked = true;
		jitsiChat.checked = false
	}else if(chatType == 'D'){
		dataChat.checked = false;
		audioChat.checked = false;
		videoChat.checked = false;
		jitsiChat.checked = true
	}else{
		document.getElementById('session-start').innerHTML = '<span style="color:red">This page runs only from a PassLok chat invitation</span>';
		throw('illegal chat type')
	}
	document.getElementById("user-name").focus()
}

//a few global variables that can be defined now; more once execution begins
var chatToken = decodeURI(location.hash),
	chatType = chatToken.charAt(1),		//A to C for Khan's WebRTC chat, D for Jitsi
	parts = chatToken.split('?'),
	chatRoom = parts[0].slice(2),
	chatPwd = parts[1],					//256 bit, base64
	sessionType = '',
	connection,
	videos = {},
	isFirefox = (typeof InstallTrigger !== 'undefined');

//change chat type based on radio buttons
dataChat.addEventListener('change',function(){if(dataChat.checked) chatType = 'A'});
audioChat.addEventListener('change',function(){if(audioChat.checked) chatType = 'B'});
videoChat.addEventListener('change',function(){if(videoChat.checked) chatType = 'C'});
jitsiChat.addEventListener('change',function(){if(jitsiChat.checked) chatType = 'D'});

//executes when "Join" is clicked
startOrJoinSession.onclick = function() {
	if(jitsiChat.checked){
		startJitsi()
	}else{
		startMuaz()
	}
}

//to replace button click with enter key				
document.getElementById('user-name').addEventListener('keyup', function(e) {
	if (e.keyCode == 13) document.getElementById('startOrJoinSession').click();
})
	
//start Jitsi chat
function startJitsi(){
	muazChat.style.display = 'none';			//make room for the jitsi window
	document.body.style.margin = 0;
	var domain = 'meet.jit.si';				//use jitsi demo server. To be changed when a server is setup
	var options = {
    		roomName: chatRoom,
			noSSL: false,
    		width: '100%',
    		height: document.documentElement.clientHeight,
			userInfo: {displayName: document.getElementById('user-name').value.trim()}
		};
	var jitsi = new JitsiMeetExternalAPI(domain, options);

	jitsi.addListener('videoConferenceJoined', function(){					//load password for initiator
		jitsi.executeCommand('password', chatPwd);
	});
	
	jitsi.addListener('passwordRequired', function(){						//load password for later joiners
		jitsi.executeCommand('password', chatPwd);
	});
}

//start Muaz chat
function startMuaz(){							// Documentation - www.RTCMultiConnection.org
	chatContainer.style.display = 'table';
	controlContainer.style.display = 'block';
	if(chatType == 'A'){
		sessionType = 'data';
		chatmsgStart = 'Text and file chat';
		muteContainer.style.display = 'none';
		camContainer.style.display = 'none'
	}else if(chatType == 'B'){
		sessionType = 'audio+data';
		chatmsgStart = 'Audio, text and file chat';
		camContainer.style.display = 'none'
	}else if(chatType == 'C'){
		sessionType = 'audio+video+data';
		chatmsgStart = 'Video, text and file chat'
	}
	document.getElementById('chatmsg').textContent = chatmsgStart + ' Names chosen by the participants will appear here as they join. For a text-only chat, you should authenticate each one.';
	
	connection = new RTCMultiConnection();
				
	// this line is VERY_important
	connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';
	
	var splittedSession = sessionType.split('+');		//format of _session is for example: data+audio+video, so splittedSession contains the components as strings

	var session = {data: false, audio: false, video: false};		//to be re-enabled
	for (var i = 0; i < splittedSession.length; i++) {
		session[splittedSession[i]] = true;				//indices: 0: data, 1: audio, 2: video
	}
	
	var localStream;

	connection.session = session;
	connection.mediaConstraints = session;
	connection.enableFileSharing = true;
	connection.filesContainer = document.getElementById('file-progress');
	connection.userid = document.getElementById('user-name').value.trim() || Math.floor(Math.random()*1000000);
	connection.password = chatPwd;

//to handle new streams
	connection.onstream = function(e) {
		var video = e.mediaElement;
		video.id = e.streamid;
		videoContainer.insertBefore(video, videoContainer.firstChild);
		videos[e.userid] = video;
		localStream = connection.attachStreams[0]		//get the stream being sent, to turn it on and off
	}

//do this when the video or audio disconnects
	connection.onstreamended = function(e) {
		e.mediaElement.style.opacity = 0;
		setTimeout(function() {
			if (e.mediaElement.parentNode) {
				e.mediaElement.parentNode.removeChild(e.mediaElement);
			}
		}, 200)
	}

//processes at different situations
	connection.onmessage = function(e) {
		appendDIV('<span style="color:brown">' + e.userid +':  </span>' + e.data);			//someone typed into the chat
		console.debug(e.userid, 'posted', e.data);
		console.log('latency:', e.latency, 'ms');
		ding.play()				//audible reminder
	}

//someone has been closed
	connection.onclose = function(e) {
		appendDIV('connection closed for ' + e.userid);
		ding.play();
		setTimeout(showPeers,200)
	}

//someone left
	connection.onleave = function(e) {
		appendDIV(e.userid + ' left the chat');
		ding.play();
		setTimeout(function(){
			showPeers();
			for(var id in videos){							//Firefox will leave zombie videos behind if they're not deleted here
				if(id == e.userid){
					var deadVideo = videos[id];
					deadVideo.parentNode.removeChild(deadVideo);
					delete videos[id]
				}
			}
		},200)
	}

//when data connection gets open
	connection.onopen = function(e) {
		if (document.getElementById('chat-input')) document.getElementById('chat-input').disabled = false;
		if (document.getElementById('file')) document.getElementById('file').disabled = false;
		if (document.getElementById('open-new-session')) document.getElementById('open-new-session').disabled = true;
		appendDIV('connected to ' + e.userid);
		ding.play();
		setTimeout(showPeers,200)
	}

//these few are for exchanging files
	var progressHelper = { };

	connection.onFileProgress = function(chunk) {
		var helper = progressHelper[chunk.uuid];
		helper.progress.value = chunk.currentPosition || chunk.maxChunks || helper.progress.max;
		updateLabel(helper.progress, helper.label);
	}

	connection.onFileStart = function(file) {
		var div = document.createElement('div');
		div.title = file.name;
		div.innerHTML = '<label>0%</label> <progress></progress>';
		appendDIV(div, fileProgress);
		progressHelper[file.uuid] = {
			div: div,
			progress: div.querySelector('progress'),
			label: div.querySelector('label')
		};
		progressHelper[file.uuid].progress.max = file.maxChunks;
	}

	connection.onFileEnd = function(file) {
		progressHelper[file.uuid].div.innerHTML = '<a href="' + file.url + '" target="_blank" download="' + file.name + '">' + file.name + '</a>';
		ding.play()
	}

	function updateLabel(progress, label) {
		if (progress.position == -1) return;
			var position = +progress.position.toFixed(2).split('.')[1] || 100;
			label.innerHTML = position + '%';
	}

	function appendDIV(div, parent) {					//gets called a lot
		if (typeof div === 'string') {
			var content = div;
			div = document.createElement('div');
			div.innerHTML = content;
		}

		if (!parent) chatOutput.insertBefore(div, chatOutput.firstChild);
		else fileProgress.insertBefore(div, fileProgress.firstChild);
		div.tabIndex = 0;
	}
	
//displays a list of participants
	function showPeers(){
		var peerList = '';
		for (var id in connection.peers){
			if(connection.peers[id].userid){
				peerList += ': ' + connection.peers[id].userid;
			}
		}
		if(peerList){
			document.getElementById('chatmsg').innerHTML = chatmsgStart + '<span style="color:brown">' + peerList + '</span>'
		}else{
			document.getElementById('chatmsg').textContent = "Participants will be listed here as they join."
		}
	}

//file sending
	document.getElementById('file').onchange = function() {
		connection.send(this.files[0]);
	}

	var chatOutput = document.getElementById('chat-output'),
		fileProgress = document.getElementById('file-progress');

//text sending
	var chatInput = document.getElementById('chat-input');
	chatInput.onkeypress = function(e) {
		if (e.keyCode !== 13 || !this.value) return;
		appendDIV('<span style="color:green">--Me: </span>' + this.value);
		connection.send(this.value);
		this.value = '';
	}

//screen sharing	
	document.getElementById('shareScreen').onclick = function() {
		connection.mediaConstraints.video = true;
		connection.addStream({
			screen: true,
			oneway: true
		});
	}
	
	var localStream = connection.attachStreams[0];		//get the stream being sent, to turn it on and off

//toggle mute	
	audioMode.addEventListener('change',function(){
		if(audioMode.checked){
			localStream.unmute('audio')
		}else{
			localStream.mute('audio')
		}
	})

//toggle camera off	
	videoMode.addEventListener('change',function(){
		if(videoMode.checked){
			localStream.unmute('video')
		}else{
			localStream.mute('video')
		}
	})

//this starts the session	
	connection.openOrJoin(chatRoom, function(isJoinedRoom, roomid, error) {
			if (error) {
				if (error === 'Invalid password') {
					chatmsg.textContent = "The chat password is incorrect"
					return
				}else if (error === 'Room not available') {
					chatmsg.textContent = "Invalid room name"
					return
				}
			}
		});
	document.getElementById('session-start').style.display = 'none';
	showPeers();
	setInterval(function(){
		resizeVideos();
		addNames();
		setTimeout(fitVideos,500)	
	},1000)		//resize videos every second, add names as titles
}

//sound to call attention to new posts and other things
var ding = document.createElement("audio");
ding.src = "ding.mp3";
ding.preload = "auto";
ding.autobuffer = "true";

//corrects video size depending on how many videos are displayed
function resizeVideos(){
	var videos = document.querySelectorAll('video');
	//first make sure all videos have loaded
	if(videos.length == 0) return;
	
	var	maxRatio = videos[0].videoHeight == 0 ? 0 : videos[0].videoWidth / videos[0].videoHeight,			//aspect ratio of widest video, start value
		visibleCount = videos.length;
	for(var i = 0; i < videos.length; i++){
		if(videos[i].poster){									//this to remove blank video streams
			if(videos[i].poster.slice(-4) != 'null'){					//looks at the poster image
				videos[i].style.display = 'none';
				visibleCount--;
				var blanked = true
			}else{
				videos[i].style.display = '';
				var blanked = false
			}
		}else if(isFirefox){									//for Firefox, actually looks at the content, and see if it's all black
			if(isBlack(videos[i])){
				videos[i].style.display = 'none';
				visibleCount--;
				var blanked = true
			}else{
				videos[i].style.display = '';
				var blanked = false
			}
		}else{
			videos[i].style.display = '';
			var blanked = false
		}
		if(!blanked) maxRatio = Math.max(maxRatio, videos[i].videoWidth / videos[i].videoHeight)
	}

	var	gridSize = Math.ceil(Math.sqrt(visibleCount));						//size of square grid containing the visible videos
	if(gridSize && maxRatio){
		var	gridHeight = videoContainer.offsetWidth / gridSize / maxRatio;
		for(var i = 0; i < videos.length; i++) videos[i].height = gridHeight - 2	//shrink or expand so all videos have equal height
	}
}

//narrows container so all videos are visible, leave room for chat if not mobile
function fitVideos(){
	var margin = (typeof window.orientation != 'undefined') ? 25: 175,
		newWidth = Math.floor((window.innerHeight - margin) * videoContainer.offsetWidth / videoContainer.offsetHeight);		//make it integer
	if(Math.abs(newWidth - videoContainer.offsetWidth) > 2) videoContainer.style.maxWidth = newWidth + 'px'
}

//adds nicknames to media elements, restarts them if stopped, flips my own video
function addNames(){
	var elements = document.querySelectorAll("audio,video"),
		myName = document.getElementById('user-name').value.trim(),
		previousId  = '';
	for(var i = 0; i < elements.length; i++){
		if(elements[i].id == previousId || elements[i].src == 'null'){			//remove duplicate or ghost element (it happens in Safari)
			elements[i].remove()
		}else{
			var name = connection.streamEvents[elements[i].id].userid;
			elements[i].title = name;				//add bubble with name; appears on hover
			previousId = elements[i].id;
			elements[i].play();					//restart if it was stopped
			if(name == myName){
				elements[i].muted = true;			//mute my own channel to avoid feedback
				elements[i].controls = false;
				if(mirrorMode.checked){										//flip my own video horizontally
					elements[i].style.MozTransform = "scale(-1, 1)";
					elements[i].style.OTransform = "scale(-1, 1)";
					elements[i].style.transform = "scale(-1, 1)";
					elements[i].style.FlipH = "display"
				}else{
					elements[i].style.MozTransform = "";
					elements[i].style.OTransform = "";
					elements[i].style.transform = "";
					elements[i].style.FlipH = ""
				}
			}else{
				elements[i].muted = false			//unmute the other channels, which might get muted accidentally
			}
		}
	}
}

//detect if a video is all black (needed in Firefox)
function isBlack(video){
	var canvas = document.createElement('canvas');
	canvas.width = 320;
	canvas.height = 240;
	var ctx = canvas.getContext('2d');
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	var pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
		sum = 0;
	for(var i = 0; i < pixels.data.length; i+=4){				//add all the values; black screen will give zero
		sum += pixels.data[i] + pixels.data[i+1] + pixels.data[i+2]
	}	
	return !sum
}