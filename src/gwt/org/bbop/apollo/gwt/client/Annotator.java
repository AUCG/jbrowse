package org.bbop.apollo.gwt.client;

import com.google.gwt.core.client.EntryPoint;
import com.google.gwt.dom.client.Style;
import com.google.gwt.event.dom.client.*;
import com.google.gwt.http.client.*;
import com.google.gwt.json.client.*;
import com.google.gwt.user.client.Window;
import com.google.gwt.user.client.ui.*;

/**
 * Entry point classes define <code>onModuleLoad()</code>.
 */
public class Annotator implements EntryPoint {

    final Panel searchPanel = new VerticalPanel();
    final TextBox nameField = new TextBox();
//    final Button searchButton = new Button("Search");
    final Label searchResult = new HTML("none");
    final CheckBox cdsCheckBox = new CheckBox();
    final CheckBox codonCheckBox = new CheckBox();

    /**
     * This is the entry point method.
     */
    public void onModuleLoad() {
        Frame frame = new Frame("http://localhost:8080/apollo/jbrowse/?loc=Group1.3%3A14865..15198&tracks=DNA%2CAnnotations%2COfficial%20Gene%20Set%20v3.2%2CGeneID%2CCflo_OGSv3.3&highlight=");
        frame.setHeight("100%");
        frame.setWidth("100%");


        SplitLayoutPanel navigationPanel = new SplitLayoutPanel();


        nameField.setWidth("100%");
        nameField.setEnabled(true);
        nameField.setReadOnly(false);
//        searchPanel.add(searchButton);
        searchPanel.add(nameField);

        Panel check1Panel = new HorizontalPanel();
        check1Panel.add(cdsCheckBox);
        check1Panel.add(new HTML("&nbsp;Check CDS"));
        cdsCheckBox.setValue(true);
        searchPanel.add(check1Panel);

        Panel check2Panel = new HorizontalPanel();
        check2Panel.add(codonCheckBox);
        codonCheckBox.setValue(true);
        check2Panel.add(new HTML("&nbsp;Check Codons"));
        searchPanel.add(check2Panel);



//        StackLayoutPanel filterPanel = new StackLayoutPanel(Style.Unit.EM);
//        filterPanel.add(searchPanel, new HTML("Search"), 4);
//        filterPanel.add(new HTML("that"), new HTML("[that]"), 4);
//        filterPanel.add(new HTML("the other"), new HTML("[the other]"), 4);

        TabPanel filterPanel = new TabPanel();
        filterPanel.setWidth("100%");
        filterPanel.add(searchPanel, "Search");
        filterPanel.add(new HTML("Browse Form"), "Browse");
        filterPanel.add(new HTML("Flag"), "Check");
        filterPanel.selectTab(0);


        Tree tree = new Tree();
        TreeItem pax6a = new TreeItem();
        pax6a.setText("pax6a");
//        pax6a.addTextItem("pax6a-001");
        pax6a.addItem(new HTML("pax6a-001 <span class='label label-warning'>CDS</span>"));
        pax6a.addTextItem("pax6a-002");
        pax6a.addItem(new HTML("pax6a-006 <span class='label label-danger'>Codon</span>"));
        tree.addItem(pax6a);

        TreeItem sox9b = new TreeItem();
        sox9b.setText("sox9b");
        sox9b.addTextItem("sox9b-001");
        sox9b.addTextItem("sox9b-002");
        sox9b.addTextItem("sox9b-004");
        tree.addItem(sox9b);

        pax6a.setState(true);
        sox9b.setState(true);

        navigationPanel.addNorth(filterPanel, 200);
        navigationPanel.add(tree);


//        VerticalPanel detailPanel = new VerticalPanel();
//        detailPanel.add(new HTML("12 Genes, 8 Transcripts"));
//        detailPanel.add(searchResult);

        FeatureDetailPanel featureDetailPanel = new FeatureDetailPanel();


//        Frame frame1 = new Frame("");
        HTML mainMenuPanel = new HTML("<div id=\"apolloLogo\" style=\"padding: 5px;\">\n" +
                "    <ul class=\"nav nav-pills header1\" >\n" +
                "        <li role=\"presentation\" class=\"\">\n" +
                "            <a href=\"http://genomearchitect.org\">\n" +
                "                <img src=\"/apollo/assets/ApolloLogo_100x36.png\" alt=\"Web Apollo\"/></a>\n" +
                "        </li>\n" +
                "\n" +
                "        <li role=\"presentation\" class=\"menu-item\">\n" +
                "            <a href=\"/apollo/organism/list\">Organisms</a>\n" +
                "        </li>\n" +
                "        <li role=\"presentation\" class=\"active menu-item\">\n" +
                "            <a href=\"/apollo/sequence/index\">Sequences</a>\n" +
                "        </li>\n" +
                "        <li role=\"presentation\" class=\" menu-item\">\n" +
                "            <a href=\"/apollo/annotator/index\">Annotate</a>\n" +
                "        </li>\n" +
                "        <li role=\"presentation\" class=\" menu-item\">\n" +
                "            <a href=\"/apollo/user/permissions\">Permissions</a>\n" +
                "        </li>\n" +
                "    </ul>\n" +
                "\n" +
                "</div>\n");
//        Frame mainMenuPanel = new Frame("http://localhost:8080/apollo/menu");
        mainMenuPanel.setWidth("100%");

        SplitLayoutPanel p = new SplitLayoutPanel();
        p.addNorth(mainMenuPanel, 55);
        p.addWest(navigationPanel, 300);
        p.addSouth(featureDetailPanel, 200);
        p.add(frame);
        RootLayoutPanel rp = RootLayoutPanel.get();
//        RootPanel rp = RootPanel.get("annotator");

        rp.add(p);
        rp.setWidgetTopHeight(p, 0, Style.Unit.PX, 100, Style.Unit.PCT);


        // Focus the cursor on the name field when the app loads
        nameField.setFocus(true);
        nameField.selectAll();

        nameField.addChangeHandler(new ChangeHandler() {

            @Override
            public void onChange(ChangeEvent event) {
                String url = "http://localhost:8080/apollo/annotator/search";
                RequestBuilder builder = new RequestBuilder(RequestBuilder.POST, URL.encode(url));
                JSONObject jsonObject = new JSONObject();
                jsonObject.put("query", new JSONString("pax6a"));
                builder.setRequestData("data=" + jsonObject.toString());
                builder.setHeader("Content-type", "application/x-www-form-urlencoded");
                RequestCallback requestCallback = new RequestCallback() {
                    @Override
                    public void onResponseReceived(Request request, Response response) {
                        JSONValue returnValue = JSONParser.parseStrict(response.getText());
                        JSONObject jsonObject = returnValue.isObject();
                        String queryString = jsonObject.get("query").isString().stringValue();

                        // TODO: use proper array parsing
                        String resultString = jsonObject.get("result").isString().stringValue();
                        resultString = resultString.replace("[", "");
                        resultString = resultString.replace("]", "");
                        searchResult.setText(" asdflkj asdflkjdas fsearch for " + queryString + " yields [" + resultString + "]");
                    }

                    @Override
                    public void onError(Request request, Throwable exception) {
                        Window.alert("ow");
                    }
                };
                try {
                    builder.setCallback(requestCallback);
                    builder.send();
                } catch (RequestException e) {
                    // Couldn't connect to server
                    Window.alert(e.getMessage());
                }

            }
        });
    }
}
