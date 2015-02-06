package org.bbop.apollo

import grails.async.Promise
import static grails.async.Promises.*


//import grails.compiler.GrailsCompileStatic
import grails.converters.JSON

//import org.bbop.apollo.editor.AnnotationEditor
import org.bbop.apollo.event.AnnotationEvent
import org.bbop.apollo.event.AnnotationListener
import org.codehaus.groovy.grails.web.json.JSONArray
import org.codehaus.groovy.grails.web.json.JSONElement
import org.codehaus.groovy.grails.web.json.JSONException
import org.codehaus.groovy.grails.web.json.JSONObject
import org.gmod.gbol.util.SequenceUtil
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.SendTo

/**
 * From the AnnotationEditorService
 */
//@GrailsCompileStatic
class AnnotationEditorController implements AnnotationListener {


    def featureService
    def transcriptService
    def configWrapperService
    def nonCanonicalSplitSiteService
    def featureRelationshipService
    def nameService
    def featurePropertyService
    def requestHandlingService

//    DataListenerHandler dataListenerHandler = DataListenerHandler.getInstance()

    public static String REST_OPERATION = "operation"
    public static String REST_TRACK = "track"
    public static String REST_FEATURES = "features"

    String REST_USERNAME = "username"
    String REST_PERMISSION = "permission"
    String REST_DATA_ADAPTER = "data_adapter"
    String REST_DATA_ADAPTERS = "data_adapters"
    String REST_KEY = "key"
    String REST_OPTIONS = "options"
    String REST_TRANSLATION_TABLE = "translation_table"

//    List<AnnotationEventListener> listenerList = new ArrayList<>()
    public AnnotationEditorController() {
//        dataListenerHandler.addDataStoreChangeListener(this);
    }

    def index() {
        log.debug "bang "
    }

    private String underscoreToCamelCase(String underscore) {
        if (!underscore || underscore.isAllWhitespace()) {
            return ''
        }
        return underscore.replaceAll(/_\w/) { it[1].toUpperCase() }
    }

    private def findPost() {
        for (p in params) {
            String key = p.key
            if (key.contains("operation")) {
                return (JSONObject) JSON.parse(key)
            }
        }
    }

    private String fixTrackHeader(String trackInput) {
        return !trackInput.startsWith("Annotations-") ? trackInput : trackInput.substring("Annotations-".size())
    }

    def handleOperation(String track, String operation) {
        // TODO: this is a hack, but it should come trhough the UrlMapper
        JSONObject postObject = findPost()
        operation = postObject.get(REST_OPERATION)
        def mappedAction = underscoreToCamelCase(operation)
        log.debug "${operation} -> ${mappedAction}"
        track = postObject.get(REST_TRACK)

        // TODO: hack needs to be fixed
//        track = fixTrackHeader(track)

        forward action: "${mappedAction}", params: [data: postObject]
    }

    /**
     * TODO: Integrate with SHIRO
     * @return
     */
    def getUserPermission() {
        log.debug "gettinguser permission !! ${params.data}"
        JSONObject returnObject = (JSONObject) JSON.parse(params.data)

        // TODO: wire into actual user table
        String username = session.getAttribute("username")
        log.debug "user from ${username}"
        username = "demo@demo.gov"
        returnObject.put(REST_PERMISSION, 3)
        returnObject.put(REST_USERNAME, username)

        render returnObject
    }

    def getDataAdapters() {
        log.debug "get data adapters !! ${params}"
        JSONObject returnObject = (JSONObject) JSON.parse(params.data)

        JSONArray dataAdaptersArray = new JSONArray();
        returnObject.put(REST_DATA_ADAPTERS, dataAdaptersArray)
        log.debug "# of data adapters ${DataAdapter.count}"
        for (DataAdapter dataAdapter in DataAdapter.all) {
            log.debug "adding data adatapter ${dataAdapter}"
            // data-adapters are embedded in groups
            // TODO: incorporate groups at some point, just children of the original . . .
            JSONObject dataAdapterJSON = new JSONObject()
            dataAdaptersArray.put(dataAdapterJSON)
            dataAdapterJSON.put(REST_KEY, dataAdapter.key)
            dataAdapterJSON.put(REST_PERMISSION, dataAdapter.permission)
            dataAdapterJSON.put(REST_OPTIONS, dataAdapter.options)
            JSONArray dataAdapterGroupArray = new JSONArray();
            // handles groups
            if (dataAdapter.dataAdapters) {
                dataAdapterJSON.put(REST_DATA_ADAPTERS, dataAdapterGroupArray)

                for (da in dataAdapter.dataAdapters) {
                    JSONObject dataAdapterChild = new JSONObject()
                    dataAdapterChild.put(REST_KEY, da.key)
                    dataAdapterChild.put(REST_PERMISSION, da.permission)
                    dataAdapterChild.put(REST_OPTIONS, da.options)
                    dataAdapterGroupArray.put(dataAdapterChild)
                }
            }
        }
        log.debug "returning data adapters  ${returnObject}"

        render returnObject
    }

    def getTranslationTable() {
        log.debug "get translation table!! ${params}"
        JSONObject returnObject = (JSONObject) JSON.parse(params.data)
        SequenceUtil.TranslationTable translationTable = SequenceUtil.getDefaultTranslationTable()
        JSONObject ttable = new JSONObject();
        for (Map.Entry<String, String> t : translationTable.getTranslationTable().entrySet()) {
            ttable.put(t.getKey(), t.getValue());
        }
        returnObject.put(REST_TRANSLATION_TABLE, ttable);
        render returnObject
    }

    private JSONObject createJSONFeatureContainer(JSONObject... features) throws JSONException {
        JSONObject jsonFeatureContainer = new JSONObject();
        JSONArray jsonFeatures = new JSONArray();
        jsonFeatureContainer.put(FeatureStringEnum.FEATURES.value, jsonFeatures);
        for (JSONObject feature : features) {
            jsonFeatures.put(feature);
        }
        return jsonFeatureContainer;
    }

    /**
     * TODO
     *  From AnnotationEditorService .. . deleteFeature 1 and 2
     */
//    { "track": "Annotations-Group1.3", "features": [ { "uniquename": "179e77b9-9329-4633-9f9e-888e3cf9b76a" } ], "operation": "delete_feature" }:
    def deleteFeature() {
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        JSONArray featuresArray = inputObject.getJSONArray(FeatureStringEnum.FEATURES.value)

        Map<String, List<Feature>> modifiedFeaturesUniqueNames = new HashMap<String, List<Feature>>();
        boolean isUpdateOperation = false

        for (int i = 0; i < featuresArray.length(); ++i) {
            JSONObject jsonFeature = featuresArray.getJSONObject(i)
            String uniqueName = jsonFeature.get(FeatureStringEnum.UNIQUENAME.value)
            Feature feature = Feature.findByUniqueName(uniqueName)
            if (feature) {
                // is this a bug?
                isUpdateOperation = isUpdateOperation || featureService.deleteFeature(feature);
                List<Feature> modifiedFeaturesList = modifiedFeaturesUniqueNames.get(uniqueName)
                if (modifiedFeaturesList == null) {
                    modifiedFeaturesList = new ArrayList<>()
                }
                modifiedFeaturesList.add(feature)
            }
        }

        featureService.updateModifiedFeaturesAfterDelete(modifiedFeaturesUniqueNames, isUpdateOperation)




        JSONObject returnObject = createJSONFeatureContainer()
        render returnObject
    }


    def addFeature() {
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        JSONArray featuresArray = inputObject.getJSONArray(FeatureStringEnum.FEATURES.value)

        JSONObject returnObject = createJSONFeatureContainer()

        println "AEC::adding feature return object ${returnObject?.size()}"
        String trackName = fixTrackHeader(inputObject.track)
        println "PRE featuresArray ${featuresArray}"
        Sequence sequence = Sequence.findByName(trackName)
        println "sequence ${sequence}"
        println "features Array size ${featuresArray.size()}"
        println "features Array ${featuresArray}"

        for (int i = 0; i < featuresArray.size(); i++) {
            JSONObject jsonFeature = featuresArray.getJSONObject(i)
            Feature newFeature = featureService.convertJSONToFeature(jsonFeature, sequence)
            featureService.updateNewGsolFeatureAttributes(newFeature)
            featureService.addFeature(newFeature)
            newFeature.save(insert: true, flush: true)

            if (newFeature instanceof Gene) {
                for (Transcript transcript : transcriptService.getTranscripts((Gene) newFeature)) {
                    if (!(newFeature instanceof Pseudogene) && transcriptService.isProteinCoding(transcript)) {
                        if (!configWrapperService.useCDS() || transcriptService.getCDS(transcript) == null) {
                            featureService.calculateCDS(transcript);
                        }
                    } else {
                        if (transcriptService.getCDS(transcript) != null) {
                            featureRelationshipService.deleteChildrenForTypes(transcript, CDS.ontologyId)
//                            transcriptService.deleteCDS(transcript);
                        }
                    }
                    nonCanonicalSplitSiteService.findNonCanonicalAcceptorDonorSpliceSites(transcript);
                    transcript.name = nameService.generateUniqueName(transcript)
                    transcript.uniqueName = transcript.name

                    returnObject.getJSONArray(FeatureStringEnum.FEATURES.value).put(featureService.convertFeatureToJSON(transcript));
                }
            } else {
                returnObject.getJSONArray(FeatureStringEnum.FEATURES.value).put(featureService.convertFeatureToJSON(newFeature));
            }
        }

        render returnObject
    }

    def setExonBoundaries(){
        println "setting exon boundaries ${params}"
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        render requestHandlingService.setExonBoundaries(inputObject)
    }


    def addExon() {
        println "adding exon ${params}"
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        render requestHandlingService.addExon(inputObject)
    }

    /**
     * // input
     *{"operation":"add_transcript","track":"Annotations-Group1.2","features":[{"location":{"fmin":247892,"strand":1,"fmax":305356},"name":"geneid_mRNA_CM000054.5_150","children":[{"location":{"fmin":305327,"strand":1,"fmax":305356},"type":{"name":"exon","cv":{"name":"sequence"}}},{"location":{"fmin":258308,"strand":1,"fmax":258471},"type":{"name":"exon","cv":{"name":"sequence"}}},{"location":{"fmin":247892,"strand":1,"fmax":247976},"type":{"name":"exon","cv":{"name":"sequence"}}},{"location":{"fmin":247892,"strand":1,"fmax":305356},"type":{"name":"CDS","cv":{"name":"sequence"}}}],"type":{"name":"mRNA","cv":{"name":"sequence"}}},{"location":{"fmin":247892,"strand":1,"fmax":305356},"name":"5e5c32e6-ca4a-4b53-85c8-b0f70c76acbd","children":[{"location":{"fmin":247892,"strand":1,"fmax":247976},"name":"00540e13-de64-4fa2-868a-e168e584f55d","uniquename":"00540e13-de64-4fa2-868a-e168e584f55d","type":"exon","date_last_modified":new Date(1415391635593)},{"location":{"fmin":258308,"strand":1,"fmax":258471},"name":"de44177e-ce76-4a9a-8313-1c654d1174aa","uniquename":"de44177e-ce76-4a9a-8313-1c654d1174aa","type":"exon","date_last_modified":new Date(1415391635586)},{"location":{"fmin":305327,"strand":1,"fmax":305356},"name":"fa49095f-cdb9-4734-8659-3286a7c727d5","uniquename":"fa49095f-cdb9-4734-8659-3286a7c727d5","type":"exon","date_last_modified":new Date(1415391635578)},{"location":{"fmin":247892,"strand":1,"fmax":305356},"name":"29b83822-d5a0-4795-b0a9-71b1651ff915","uniquename":"29b83822-d5a0-4795-b0a9-71b1651ff915","type":"cds","date_last_modified":new Date(1415391635600)}],"uniquename":"df08b046-ed1b-4feb-93fc-53adea139df8","type":"mrna","date_last_modified":new Date(1415391635771)}]}*
     * // returned form the fir method
     *{"operation":"ADD","sequenceAlterationEvent":false,"features":[{"location":{"fmin":670576,"strand":1,"fmax":691185},"parent_type":{"name":"gene","cv":{"name":"sequence"}},"name":"geneid_mRNA_CM000054.5_38","children":[{"location":{"fmin":670576,"strand":1,"fmax":670658},"parent_type":{"name":"mRNA","cv":{"name":"sequence"}},"properties":[{"value":"demo","type":{"name":"owner","cv":{"name":"feature_property"}}}],"uniquename":"60072F8198F38EB896FB218D2862FFE4","type":{"name":"exon","cv":{"name":"sequence"}},"date_last_modified":1415391541148,"parent_id":"D1D1E04521E6FFA95FD056D527A94730"},{"location":{"fmin":690970,"strand":1,"fmax":691185},"parent_type":{"name":"mRNA","cv":{"name":"sequence"}},"properties":[{"value":"demo","type":{"name":"owner","cv":{"name":"feature_property"}}}],"uniquename":"CC6058CFA17BD6DB8861CC3B6FA1E4B1","type":{"name":"exon","cv":{"name":"sequence"}},"date_last_modified":1415391541148,"parent_id":"D1D1E04521E6FFA95FD056D527A94730"},{"location":{"fmin":670576,"strand":1,"fmax":691185},"parent_type":{"name":"mRNA","cv":{"name":"sequence"}},"properties":[{"value":"demo","type":{"name":"owner","cv":{"name":"feature_property"}}}],"uniquename":"6D85D94970DE82168B499C75D886FB89","type":{"name":"CDS","cv":{"name":"sequence"}},"date_last_modified":1415391541148,"parent_id":"D1D1E04521E6FFA95FD056D527A94730"}],"properties":[{"value":"demo","type":{"name":"owner","cv":{"name":"feature_property"}}}],"uniquename":"D1D1E04521E6FFA95FD056D527A94730","type":{"name":"mRNA","cv":{"name":"sequence"}},"date_last_modified":1415391541169,"parent_id":"8E2895FDD74F4F9DF9F6785B72E04A50"}]}* @return
     */
    def addTranscript() {
        println "AEC::adding transcript ${params}"
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        render requestHandlingService.addTranscript(inputObject)
    }

    def setTranslationStart(){
        println "AEC::set translation start ${params}"
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        render requestHandlingService.setTranslationStart(inputObject)
    }

    def setTranslationEnd(){
        println "AEC::set translation end ${params}"
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        render requestHandlingService.setTranslationEnd(inputObject)
    }

    def setBoundaries(){
        println "AEC::set boundaries ${params}"
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        render requestHandlingService.setBoundaries(inputObject)
    }

/**
 *
 * Should return of form:
 *{"features": [{"location": {"fmin": 511,
 "strand": - 1,
 "fmax": 656},
 "parent_type": {"name": "gene",
 "cv": {"name": "sequence"}},
 "name": "gnl|Amel_4.5|TA31.1_00029673-1",
 * @return
 */
    def getFeatures() {

        JSONObject returnObject = (JSONObject) JSON.parse(params.data)
        render requestHandlingService.getFeatures(returnObject)
    }

//    private void fireDataStoreChange(DataStoreChangeEvent... events) {
//        AbstractDataStoreManager.getInstance().fireDataStoreChange(events);
//    }

    def getSequenceAlterations() {
        log.debug "getting sequence alterations "
        JSONObject returnObject = (JSONObject) JSON.parse(params.data)
        JSONArray jsonFeatures = new JSONArray()
        returnObject.put(FeatureStringEnum.FEATURES.value, jsonFeatures)

        // TODO: get alternations from session
//        for (SequenceAlteration alteration : editor.getSession().getSequenceAlterations()) {
//            jsonFeatures.put(JSONUtil.convertBioFeatureToJSON(alteration));
//        }

        render returnObject
    }

    def getOrganism() {
//        JSONObject organism = new JSONObject();
//        if (editor.getSession().getOrganism() == null) {
//            return;
//        }
//        organism.put("genus", editor.getSession().getOrganism().getGenus());
//        organism.put("species", editor.getSession().getOrganism().getSpecies());
//        out.write(organism.toString());

        // the editor is bound to the session
        log.debug "getting sequence alterations "
//        JSONObject returnObject = (JSONObject) JSON.parse(params.data)

        // TODO: implement this from the session
        String organismName = session.getAttribute(FeatureStringEnum.ORGANISM.value)
        if (organismName) {
            Organism organism = Organism.findByCommonName(organismName)
            if (organism) {
                render organism as JSON
                return
            }
        }
        render new JSONObject()

//
//        JSONArray jsonFeatures = new JSONArray()
//        returnObject.put("features",jsonFeatures)
    }

//    @Override
//    def handleEvent(AnnotationEvent annotationEvent) {
//        println "hadnling event"
//        return null
//    }

    /**
     * TODO: link to the database for real config values
     * @return
     */
    def getAnnotationInfoEditorConfiguration() {
        println "getting the config "
        JSONObject annotationInfoEditorConfigContainer = new JSONObject();
        JSONArray annotationInfoEditorConfigs = new JSONArray();
        annotationInfoEditorConfigContainer.put(FeatureStringEnum.ANNOTATION_INFO_EDITOR_CONFIGS.value, annotationInfoEditorConfigs);
//        for (ServerConfiguration.AnnotationInfoEditorConfiguration annotationInfoEditorConfiguration : annotationInfoEditorConfigurations.values()) {
        JSONObject annotationInfoEditorConfig = new JSONObject();
        annotationInfoEditorConfigs.put(annotationInfoEditorConfig);
        if (configWrapperService.hasStatus()) {
            JSONArray statusArray = new JSONArray()
            annotationInfoEditorConfig.put(FeatureStringEnum.STATUS.value, statusArray);
            Status.all.each { status ->
                statusArray.add(status.value)
            }
//                for (String status : annotationInfoEditorConfiguration.getStatus()) {
//                    annotationInfoEditorConfig.append("status", status);
//                }
        }
//            if (annotationInfoEditorConfiguration.hasDbxrefs()) {
        annotationInfoEditorConfig.put(FeatureStringEnum.HASDBXREFS.value, true);
//            }
//            if (annotationInfoEditorConfiguration.hasAttributes()) {
        annotationInfoEditorConfig.put(FeatureStringEnum.HASATTRIBUTES.value, true);
//            }
//            if (annotationInfoEditorConfiguration.hasPubmedIds()) {
        annotationInfoEditorConfig.put(FeatureStringEnum.HASPUBMEDIDS.value, true);
//            }
//            if (annotationInfoEditorConfiguration.hasGoIds()) {
        annotationInfoEditorConfig.put(FeatureStringEnum.HASGOIDS.value, true);
//            }
//            if (annotationInfoEditorConfiguration.hasComments()) {
        annotationInfoEditorConfig.put(FeatureStringEnum.HASCOMMENTS.value, true);
//            }
        JSONArray supportedTypes = new JSONArray();
        supportedTypes.add(FeatureStringEnum.DEFAULT.value)
        annotationInfoEditorConfig.put(FeatureStringEnum.SUPPORTED_TYPES.value, supportedTypes);
//            for (String supportedType : annotationInfoEditorConfiguration.getSupportedFeatureTypes()) {
//                supportedTypes.put(supportedType);
//            }
//        }
//        out.write(annotationInfoEditorConfigContainer.toString());
        println "return config ${annotationInfoEditorConfigContainer}"
        render annotationInfoEditorConfigContainer
    }


    def setDescription() {
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        return requestHandlingService.updateDescription(inputObject)
    }

    def setSymbol() {
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        render requestHandlingService.updateSymbol(inputObject)
    }

    def setReadthroughStopCodon() {
        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        render requestHandlingService.setReadthroughStopCodon(inputObject)
    }

    def getAnnotationInfoEditorData() {

        JSONObject inputObject = (JSONObject) JSON.parse(params.data)
        String trackName = fixTrackHeader(inputObject.track)
        Sequence sequence = Sequence.findByName(trackName)
        JSONArray featuresArray = inputObject.getJSONArray(FeatureStringEnum.FEATURES.value)

        println "sequence ${sequence} for track ${trackName}"


        JSONObject returnObject = createJSONFeatureContainer()

        for (int i = 0; i < featuresArray.length(); ++i) {
            JSONObject jsonFeature = featuresArray.getJSONObject(i);
            println "input json feature ${jsonFeature}"
            String uniqueName = jsonFeature.get(FeatureStringEnum.UNIQUENAME.value)
            Feature feature = Feature.findByUniqueName(uniqueName)
            println "feature converted? ${feature}"
            println "retrieved feature ${feature.name} ${feature.uniqueName}"
            JSONObject newFeature = featureService.convertFeatureToJSON(feature, false)

            if (feature.symbol) newFeature.put(FeatureStringEnum.SYMBOL.value, feature.symbol)
            if (feature.description) newFeature.put(FeatureStringEnum.DESCRIPTION.value, feature.description)

//            if (feature.getTimeAccessioned() != null) {
            jsonFeature.put(FeatureStringEnum.DATE_CREATION.value, feature.dateCreated.time);
//            }
//            if (feature.getTimeLastModified() != null) {
            jsonFeature.put(FeatureStringEnum.DATE_LAST_MODIFIED.value, feature.lastUpdated.time);
//            }

            // TODO: add the rest of the attributes

            if (configWrapperService.hasAttributes()) {
                JSONArray properties = new JSONArray();
                newFeature.put(FeatureStringEnum.NON_RESERVED_PROPERTIES.value, properties);
                for (FeatureProperty property : feature.featureProperties) {
                    JSONObject jsonProperty = new JSONObject();
                    jsonProperty.put(FeatureStringEnum.TAG.value, property.getTag());
                    jsonProperty.put(FeatureStringEnum.VALUE.value, property.getValue());
                    properties.put(jsonProperty);
                }
            }
            if (configWrapperService.hasDbxrefs() || configWrapperService.hasPubmedIds() || configWrapperService.hasGoIds()) {
                JSONArray dbxrefs = new JSONArray();
                newFeature.put(FeatureStringEnum.DBXREFS.value, dbxrefs);
                for (DBXref dbxref : feature.featureDBXrefs) {
                    JSONObject jsonDbxref = new JSONObject();
                    jsonDbxref.put(FeatureStringEnum.DB.value, dbxref.getDb().getName());
                    jsonDbxref.put(FeatureStringEnum.ACCESSION.value, dbxref.getAccession());
                    dbxrefs.put(jsonDbxref);
                }
            }
            if (configWrapperService.hasComments()) {
                JSONArray comments = new JSONArray();
                newFeature.put(FeatureStringEnum.COMMENTS.value, comments);
                for (Comment comment : featurePropertyService.getComments(feature)) {
                    comments.put(comment.value);
                }
                JSONArray cannedComments = new JSONArray();
                newFeature.put(FeatureStringEnum.CANNED_COMMENTS.value, cannedComments);

                Collection<String> cc = CannedComment.findAllByOntologyId(feature.ontologyId)*.comment;
                if (cc != null) {
                    for (String comment : cc) {
                        cannedComments.put(comment);
                    }
                }
            }
            returnObject.getJSONArray(FeatureStringEnum.FEATURES.value).put(newFeature);
        }


        render returnObject
    }

    @MessageMapping("/hello")
    @SendTo("/topic/hello")
    protected String hello(String inputString){
        println "hello in the house! ${inputString}"
        return "i[${inputString}]"
    }


    @MessageMapping("/AnnotationNotification")
    @SendTo("/topic/AnnotationNotification")
    protected String annotationEditor(String inputString) {
        println "Input String:  annotation editor service ${inputString}"
        JSONObject rootElement = (JSONObject) JSON.parse(inputString)

        println "AEC::root element: ${rootElement}"
        String operation = ((JSONObject) rootElement).get(REST_OPERATION)

        String operationName = underscoreToCamelCase(operation)
        println "operationName: ${operationName}"
//        handleOperation(track,operation)
        def p = task {
            switch (operationName) {
                case "addTranscript": requestHandlingService.addTranscript(rootElement)
                    break
                case "setName":  requestHandlingService.updateName(rootElement)
                    break
                case "addNonPrimaryDbxrefs":  requestHandlingService.addNonPrimaryDbxrefs(rootElement)
                    break
                case "deleteNonPrimaryDbxrefs":  requestHandlingService.deleteNonPrimaryDbxrefs(rootElement)
                    break
                case "updateNonPrimaryDbxrefs":  requestHandlingService.updateNonPrimaryDbxrefs(rootElement)
                    break
                case "setSymbol":  requestHandlingService.updateSymbol(rootElement)
                    break
                case "setDescription":  requestHandlingService.updateDescription(rootElement)
                    break
                case "setTranslationStart":  requestHandlingService.setTranslationStart(rootElement)
                    break
                case "setTranslationEnd":  requestHandlingService.setTranslationEnd(rootElement)
                    break
                case "addExon":  requestHandlingService.addExon(rootElement)
                    break
                case "setExonBoundaries":  requestHandlingService.setExonBoundaries(rootElement)
                    break
                case "setBoundaries":  requestHandlingService.setBoundaries(rootElement)
                    break
                case "setLongestOrf":  requestHandlingService.setLongestOrf(rootElement)
                    break
                case "setReadthroughStopCodon":  requestHandlingService.setReadthroughStopCodon(rootElement)
                    break
                case "setToDownstreamDonor":  requestHandlingService.setDonor(rootElement,false)
                    break
                case "setToUpstreamDonor":  requestHandlingService.setDonor(rootElement,true)
                    break
                default: nameService.generateUniqueName()
                    break
            }
        }
        def results = p.get()
        println "completling result ${results as JSON}"
        return results

//        p.onComplete([p]){ List results ->
//            println "completling result ${results}"
//            return "returning annotationEditor ${inputString}!"
//        }
//        p.onError([p]){ List results ->
//            println "error ${results}"
//            return "ERROR returning annotationEditor ${inputString}!"
//        }

    }


    @SendTo("/topic/AnnotationNotification")
    protected String sendAnnotationEvent(String returnString) {
        println "AEC::return operations sent . . ${returnString?.size()}"
        return returnString
    }

    synchronized void handleChangeEvent(AnnotationEvent... events) {
        println "handingling event ${events.length}"
        if (events.length == 0) {
            return;
        }
//        sendAnnotationEvent(events)
        // TODO: this is more than a bit of a hack
//        String sequenceName = "Annotations-${events[0].sequence.name}"
        JSONArray operations = new JSONArray();
        for (AnnotationEvent event : events) {
            JSONObject features = event.getFeatures();
            try {
                features.put("operation", event.getOperation().name());
                features.put("sequenceAlterationEvent", event.isSequenceAlterationEvent());
                operations.put(features);
            }
            catch (JSONException e) {
                log.error("error handling change event ${event}: ${e}")
            }
        }

        sendAnnotationEvent(operations.toString())

    }
}
