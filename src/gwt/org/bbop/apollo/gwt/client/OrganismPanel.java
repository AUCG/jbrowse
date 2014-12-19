package org.bbop.apollo.gwt.client;

import com.google.gwt.cell.client.ClickableTextCell;
import com.google.gwt.cell.client.NumberCell;
import com.google.gwt.core.client.GWT;
import com.google.gwt.safehtml.shared.SafeHtml;
import com.google.gwt.safehtml.shared.SafeHtmlBuilder;
import com.google.gwt.text.shared.AbstractSafeHtmlRenderer;
import com.google.gwt.text.shared.SafeHtmlRenderer;
import com.google.gwt.uibinder.client.UiBinder;
import com.google.gwt.uibinder.client.UiField;
import com.google.gwt.user.cellview.client.Column;
import com.google.gwt.user.cellview.client.ColumnSortEvent;
import com.google.gwt.user.cellview.client.DataGrid;
import com.google.gwt.user.cellview.client.TextColumn;
import com.google.gwt.user.client.ui.*;
import com.google.gwt.view.client.ListDataProvider;
import org.bbop.apollo.gwt.client.demo.DataGenerator;
import org.bbop.apollo.gwt.client.dto.OrganismInfo;

import java.util.Comparator;
import java.util.List;

/**
 * Created by ndunn on 12/17/14.
 */
public class OrganismPanel extends Composite {
    interface OrganismBrowserPanelUiBinder extends UiBinder<Widget, OrganismPanel> {
    }

    private static OrganismBrowserPanelUiBinder ourUiBinder = GWT.create(OrganismBrowserPanelUiBinder.class);
    @UiField
    HTML organismName;
    @UiField
    HTML trackCount;
    @UiField
    HTML annotationCount;
    @UiField
    DataGrid<OrganismInfo> organismTable;

    public OrganismPanel() {
        initWidget(ourUiBinder.createAndBindUi(this));

        TextColumn<OrganismInfo> organismNameColumn = new TextColumn<OrganismInfo>() {
            @Override
            public String getValue(OrganismInfo employee) {
                return employee.getName();
            }
        };
        organismNameColumn.setSortable(true);

        Column<OrganismInfo,Number> annotationsNameColumn = new Column<OrganismInfo,Number>(new NumberCell()) {
            @Override
            public Integer getValue(OrganismInfo object) {
                return object.getNumFeatures();
            }
        };
        annotationsNameColumn.setSortable(true);
        Column<OrganismInfo,Number> sequenceColumn = new Column<OrganismInfo,Number>(new NumberCell()) {
            @Override
            public Integer getValue(OrganismInfo object) {
                return object.getNumSequences();
            }
        };
        sequenceColumn.setSortable(true);
        Column<OrganismInfo,Number> tracksColumn = new Column<OrganismInfo,Number>(new NumberCell()) {
            @Override
            public Integer getValue(OrganismInfo object) {
                return object.getNumTracks();
            }
        };
        tracksColumn.setSortable(true);

        SafeHtmlRenderer<String> anchorRenderer = new AbstractSafeHtmlRenderer<String>() {
            @Override
            public SafeHtml render(String object) {
                SafeHtmlBuilder sb = new SafeHtmlBuilder();
                sb.appendHtmlConstant("(<a href=\"javascript:;\">").appendEscaped(object)
                        .appendHtmlConstant("</a>)");
                return sb.toSafeHtml();
            }
        };

        Column<OrganismInfo,String> actionColumn = new Column<OrganismInfo, String>(new ClickableTextCell(anchorRenderer)) {
            @Override
            public String getValue(OrganismInfo employee) {
                return "Select";
            }
        };

        organismTable.addColumn(organismNameColumn, "Name");
        organismTable.addColumn(annotationsNameColumn, "Annotations");
        organismTable.addColumn(sequenceColumn, "Sequences");
        organismTable.addColumn(tracksColumn, "Tracks");
        organismTable.addColumn(actionColumn,"Action");


        ListDataProvider<OrganismInfo> dataProvider = new ListDataProvider<>();
        dataProvider.addDataDisplay(organismTable);

        List<OrganismInfo> trackInfoList = dataProvider.getList();

        for(String organism : DataGenerator.getOrganisms()){
            trackInfoList.add(new OrganismInfo(organism));
        }

        ColumnSortEvent.ListHandler<OrganismInfo> sortHandler = new ColumnSortEvent.ListHandler<OrganismInfo>(trackInfoList);
        organismTable.addColumnSortHandler(sortHandler);
        sortHandler.setComparator(organismNameColumn, new Comparator<OrganismInfo>() {
            @Override
            public int compare(OrganismInfo o1, OrganismInfo o2) {
                return o1.getName().compareTo(o2.getName());
            }
        });
        sortHandler.setComparator(annotationsNameColumn, new Comparator<OrganismInfo>() {
            @Override
            public int compare(OrganismInfo o1, OrganismInfo o2) {
                return o1.getNumFeatures()-o2.getNumFeatures();
            }
        });
        sortHandler.setComparator(sequenceColumn, new Comparator<OrganismInfo>() {
            @Override
            public int compare(OrganismInfo o1, OrganismInfo o2) {
                return o1.getNumSequences()-o2.getNumSequences();
            }
        });
        sortHandler.setComparator(tracksColumn, new Comparator<OrganismInfo>() {
            @Override
            public int compare(OrganismInfo o1, OrganismInfo o2) {
                return o1.getNumTracks()-o2.getNumTracks();
            }
        });

        organismName.setHTML("Danio rerio");
        trackCount.setHTML("30");
        annotationCount.setHTML("1223");

//        DataGenerator.populateOrganismTable(organismTable);

    }
}