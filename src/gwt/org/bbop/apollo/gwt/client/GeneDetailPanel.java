package org.bbop.apollo.gwt.client;

import com.google.gwt.core.client.GWT;
import com.google.gwt.event.dom.client.ChangeEvent;
import com.google.gwt.http.client.*;
import com.google.gwt.i18n.client.Dictionary;
import com.google.gwt.json.client.*;
import com.google.gwt.uibinder.client.UiBinder;
import com.google.gwt.uibinder.client.UiField;
import com.google.gwt.uibinder.client.UiHandler;
import com.google.gwt.user.cellview.client.Column;
import com.google.gwt.user.client.Window;
import com.google.gwt.user.client.ui.*;
import com.google.gwt.user.client.ui.Label;
import org.gwtbootstrap3.client.ui.*;
import org.gwtbootstrap3.client.ui.gwt.CellTable;

/**
 * Created by ndunn on 1/9/15.
 */
public class GeneDetailPanel extends Composite {

    interface AnnotationDetailPanelUiBinder extends UiBinder<Widget, GeneDetailPanel> {
    }

    Dictionary dictionary = Dictionary.getDictionary("Options");
    String rootUrl = dictionary.get("rootUrl");

    private static AnnotationDetailPanelUiBinder ourUiBinder = GWT.create(AnnotationDetailPanelUiBinder.class);
    @UiField
    org.gwtbootstrap3.client.ui.TextBox nameField;
    @UiField
    org.gwtbootstrap3.client.ui.TextBox symbolField;
    @UiField
    org.gwtbootstrap3.client.ui.TextBox descriptionField;
    @UiField
    InputGroupAddon locationField;

    private JSONObject internalData ;

    public GeneDetailPanel() {
        initWidget(ourUiBinder.createAndBindUi(this));

    }

    @UiHandler("nameField")
    void handleNameChange(ChangeEvent e) {
//        Window.alert("changed: "+e);
        String updatedName = nameField.getText();
        internalData.put("name", new JSONString(updatedName));
        updateGene(internalData);
    }

    @UiHandler("symbolField")
    void handleSymbolChange(ChangeEvent e) {
//        Window.alert("symbol field changed: "+e);
        String updatedName = symbolField.getText();
        internalData.put("symbol", new JSONString(updatedName));
        updateGene(internalData);
    }

    @UiHandler("descriptionField")
    void handleDescriptionChange(ChangeEvent e) {
//        Window.alert("symbol field changed: "+e);
        String updatedName = descriptionField.getText();
        internalData.put("description", new JSONString(updatedName));
        updateGene(internalData);
    }

    private void enableFields(boolean enabled){
        nameField.setEnabled(enabled);
        symbolField.setEnabled(enabled);
        descriptionField.setEnabled(enabled);
    }


    private void updateGene(JSONObject internalData) {
        String url = rootUrl + "/annotator/updateGene";
        RequestBuilder builder = new RequestBuilder(RequestBuilder.POST, URL.encode(url));
        builder.setHeader("Content-type", "application/x-www-form-urlencoded");
        StringBuilder sb = new StringBuilder();
        sb.append("data="+internalData.toString());
//        sb.append("&key2=val2");
//        sb.append("&key3=val3");
        builder.setRequestData(sb.toString());
        enableFields(false);
        RequestCallback requestCallback = new RequestCallback() {
            @Override
            public void onResponseReceived(Request request, Response response) {
                JSONValue returnValue = JSONParser.parseStrict(response.getText());
//                Window.alert("successful update: "+returnValue);
                enableFields(true);
            }

            @Override
            public void onError(Request request, Throwable exception) {
                Window.alert("Error updating gene: "+exception);
                enableFields(true);
            }
        };
        try {
            builder.setCallback(requestCallback);
            builder.send();
        } catch (RequestException e) {
            enableFields(true);
            // Couldn't connect to server
            Window.alert(e.getMessage());
        }

    }

    /**
     * {"date_creation":1420750302883, "symbol":"sdf", "location":{"fmin":14836, "strand":-1, "fmax":15043}, "description":"adsf", "name":"GB50347-RAaa", "children":[{"date_creation":1420750302872, "symbol":"sdf", "location":{"fmin":14836, "strand":-1, "fmax":15043}, "description":"sdf", "parent_type":{"name":"gene", "cv":{"name":"sequence"}}, "name":"GB50347-RA-00001asdf", "children":[{"date_creation":1420750302852, "location":{"fmin":14836, "strand":-1, "fmax":15043}, "parent_type":{"name":"mRNA", "cv":{"name":"sequence"}}, "name":"ac106657-8872-4c16-85f6-db0da33b4248", "uniquename":"ac106657-8872-4c16-85f6-db0da33b4248", "type":{"name":"exon", "cv":{"name":"sequence"}}, "date_last_modified":1420750302957, "parent_id":"8a6c6037-9878-4b2e-9bb7-fe090e24c24b"}], "properties":[{"value":"sdf", "type":{"cv":{"name":"feature_property"}}},{"value":"sdf", "type":{"cv":{"name":"feature_property"}}}], "uniquename":"8a6c6037-9878-4b2e-9bb7-fe090e24c24b", "type":{"name":"mRNA", "cv":{"name":"sequence"}}, "date_last_modified":1420754201629, "parent_id":"c8288815-c476-41da-a4d0-f13f940acff5"}], "properties":[{"value":"sdf", "type":{"cv":{"name":"feature_property"}}},{"value":"adsf", "type":{"cv":{"name":"feature_property"}}}], "uniquename":"c8288815-c476-41da-a4d0-f13f940acff5", "type":{"name":"gene", "cv":{"name":"sequence"}}, "date_last_modified":1420750327299}
     * @param internalData
     */
    public void updateData(JSONObject internalData) {
        this.internalData = internalData ;
        nameField.setText(internalData.get("name").isString().stringValue());
        symbolField.setText(internalData.get("symbol").isString().stringValue());
        descriptionField.setText(internalData.get("description").isString().stringValue());

        JSONObject locationObject = internalData.get("location").isObject();
        String locationText =  locationObject.get("fmin").isNumber().toString()  ;
        locationText +=  " - ";
        locationText +=  locationObject.get("fmax").isNumber().toString()  ;
        locationText +=  " strand(";
        locationText +=  locationObject.get("strand").isNumber().doubleValue()>0 ? "+" : "-"  ;
        locationText +=  ")";

        locationField.setText(locationText);

        setVisible(true);
    }
}