<!-- The DOCTYPE declaration above will set the     -->
<!-- browser's rendering engine into                -->
<!-- "Standards Mode". Replacing this declaration   -->
<!-- with a "Quirks Mode" doctype is not supported. -->

<%@ page contentType="text/html;charset=UTF-8" %>
<!DOCTYPE html>
<html>
<head>

    <meta name="layout" content="annotator2">
    %{--<meta name="layout" content="main"/>--}%
    <title>Annotator</title>

    <asset:javascript src="spring-websocket"/>

    <script type="text/javascript" language="javascript" src="annotator.nocache.js"></script>
    <script>
        var Options = {
            rootUrl: '${applicationContext.servletContext.getContextPath()}'
            , showFrame: '${params.showFrame  && params.showFrame == 'true' ? 'true' : 'false' }'
        };

        //     $(function() {
        var socket = new SockJS("${createLink(uri: '/stomp')}");
        var client = Stomp.over(socket);

        client.connect({}, function () {
            client.subscribe("/topic/AnnotationNotification", function (message) {
//                var returnMessage = JSON.parse(message.body);
                window.reloadAnnotations();
            });

        });



        var sendTrackUpdate = function (track) {
            console.log('publishing track update: ' + track);
            client.send("/topic/TrackList", {}, track);
            console.log('PUBLSISHED track update: ' + track);
//                var returnMessage = JSON.parse(message.body);
//                window.reloadAnnotations();
        };

        var getAllTracks = function () {
//            console.log('getting all tracks: '+track);
            var commandObject = {};
            commandObject.command = "list";

            console.log('connecting . . ');
//                console.log('connectED . . ');
            console.log('PUBLSISHING track list: ' + commandObject);
            console.log('PUBLSISHED track list: ' + commandObject);
            client.subscribe("/topic/TrackListReturn", function (message) {
                console.log('subscribed . . ' + message);
//                var returnMessage = JSON.parse(message.body);
                return message;
            });
            client.send("/topic/TrackList", {}, commandObject);
//                var returnMessage = JSON.parse(message.body);
//                window.reloadAnnotations();
        };
    </script>
</head>

<body style="background-color: white;">

%{--<div id="annotator" style="background-color: white;"></div>--}%

<!-- RECOMMENDED if your web app will not function without JavaScript enabled -->
<noscript>
    <div style="width: 22em; position: absolute; left: 50%; margin-left: -11em; color: red; background-color: white; border: 1px solid red; padding: 4px; font-family: sans-serif">
        Your web browser must have JavaScript enabled
        in order for this application to display correctly.
    </div>
</noscript>

</body>
</html>
