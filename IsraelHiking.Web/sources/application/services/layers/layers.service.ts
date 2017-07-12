﻿import { Injectable } from "@angular/core";
import { Http } from "@angular/http";
import { LocalStorage } from "ngx-store";
import { MapService } from "../map.service";
import { WikiMarkersLayer } from "./wiki-markers.layer";
import { NakebMarkerLayer } from "./nakeb-markers.layer";
import { ResourcesService } from "../resources.service";
import { Urls } from "../../common/Urls";
import * as _ from "lodash";
import * as Common from "../../common/IsraelHiking";
import "leaflet.gridlayer.googlemutant";

export interface ILayer extends Common.LayerData {
    layer: L.Layer;
    isEditable: boolean;
}

export interface IBaseLayer extends ILayer {
    selected: boolean;
}

export interface IOverlay extends ILayer {
    visible: boolean;
}

@Injectable()
export class LayersService {
    public static ISRAEL_MTB_MAP = "Israel MTB Map";
    public static ISRAEL_HIKING_MAP = "Israel Hiking Map";
    public static GOOGLE_EARTH = "Google Earth";
    public static MIN_ZOOM = 7;
    public static MAX_NATIVE_ZOOM = 16;

    private static MAX_ZOOM = 20;
    private static HIKING_TRAILS = "Hiking Trails";
    private static ATTRIBUTION = "Tiles © <a href='https://IsraelHiking.osm.org.il' target='_blank'>Israel Hiking</a>, <a href='https://creativecommons.org/licenses/by-nc-sa/3.0/' target='_blank'>CC BY-SA-NC 3.0</a>. Data by <a href='https://openstreetmap.org' target='_blank'>OpenStreetMap</a> under <a href='https://opendatacommons.org/licenses/odbl/summary/' target='_blank'>ODbL</a>. ";
    private static MTB_ATTRIBUTION = LayersService.ATTRIBUTION + "Map style courtesy of <a href='http://mtbmap.no'>MTBmap.no.</a> ";
    private static BASE_LAYERS_KEY = "BaseLayers";
    private static OVERLAYS_KEY = "Overlays";
    private static ACTIVE_BASELAYER_KEY = "ActiveBaseLayer";
    private static ACTIVE_OVERLAYS_KEY = "ActiveOverlays";
    private static CUSTOM_LAYER = "Custom Layer";

    @LocalStorage()
    private storedBaseLayers: Common.LayerData[] = [];
    @LocalStorage()
    private storedOverlays: Common.LayerData[] = [];
    @LocalStorage()
    private selectedBaseLayerKey: string = LayersService.ISRAEL_HIKING_MAP;
    @LocalStorage()
    private activeOverlayKeys: string[] = [];

    private overlayZIndex: any;

    public baseLayers: IBaseLayer[];
    public overlays: IOverlay[];
    public selectedBaseLayer: IBaseLayer;

    constructor(private http: Http,
        private mapService: MapService,
        private resourcesService: ResourcesService,
        private wikiMarkersLayer: WikiMarkersLayer,
        private nakebMarkerLayer: NakebMarkerLayer) {
        this.selectedBaseLayer = null;
        this.baseLayers = [];
        this.overlays = [];
        this.overlayZIndex = 10;
        this.initializeDefaultBaseLayers();

        // Default initialization - must be before toggling overlays from storage
        this.selectedBaseLayer = this.baseLayers[0];
        this.mapService.map.addLayer(this.selectedBaseLayer.layer);

        this.addLayersFromLocalStorage();
        this.resourcesService.languageChanged.asObservable().subscribe(() => this.changeLanguage());
    }

    private initializeDefaultBaseLayers() {
        this.addBaseLayer({
            key: LayersService.ISRAEL_HIKING_MAP,
            address: this.resourcesService.currentLanguage.tilesFolder + Urls.DEFAULT_TILES_ADDRESS,
            isEditable: false
        } as ILayer, LayersService.ATTRIBUTION);

        this.addBaseLayer({
            key: LayersService.ISRAEL_MTB_MAP,
            address: this.resourcesService.currentLanguage.tilesFolder + Urls.MTB_TILES_ADDRESS,
            isEditable: false
        } as ILayer, LayersService.MTB_ATTRIBUTION);
        try {
            var googleLayer = L.gridLayer.googleMutant({ type: "satellite" } as L.gridLayer.GoogleMutantOptions) as any;
            this.baseLayers.push({ key: LayersService.GOOGLE_EARTH, layer: googleLayer, selected: false, address: "", isEditable: false } as IBaseLayer);
        } catch (e) {
            console.error("Unable to create the google earth layer... ");
        }

        let hikingTrailsOverlay = this.addOverlay({
            key: LayersService.HIKING_TRAILS,
            address: Urls.OVERLAY_TILES_ADDRESS,
            minZoom: LayersService.MIN_ZOOM,
            maxZoom: LayersService.MAX_NATIVE_ZOOM
        } as ILayer);
        hikingTrailsOverlay.isEditable = false;

        this.overlays.push({ visible: false, isEditable: false, address: "", key: "Wikipedia", layer: this.wikiMarkersLayer as L.Layer } as IOverlay);
        this.overlays.push({ visible: false, isEditable: false, address: "", key: "Nakeb", layer: this.nakebMarkerLayer as L.Layer } as IOverlay);
        
        this.changeLanguage();
    }
    
    public addBaseLayer = (layerData: Common.LayerData, attribution?: string, position?: number): IBaseLayer => {
        var layer = _.find(this.baseLayers, (layerToFind) => layerToFind.key.toLocaleLowerCase() === layerData.key.toLocaleLowerCase());
        if (layer != null) {
            return layer; // layer exists
        }
        layer = this.addNewBaseLayer(layerData, attribution, position);
        this.storedBaseLayers.push(layerData);
        this.storedBaseLayers = this.unique(this.storedBaseLayers);
        return layer;
    }

    private addNewBaseLayer = (layerData: Common.LayerData, attribution?: string, position?: number): IBaseLayer => {
        let layer = { ...layerData } as IBaseLayer;
        layer.layer = L.tileLayer(layerData.address, this.createOptionsFromLayerData(layerData, attribution));
        if (position != undefined) {
            this.baseLayers.splice(position, 0, layer);
        } else {
            this.baseLayers.push(layer);
        }
        return layer;
    }

    public addOverlay = (layerData: Common.LayerData): IOverlay => {
        var overlay = _.find(this.overlays, (overlayToFind) => overlayToFind.key.toLocaleLowerCase() === layerData.key.toLocaleLowerCase());
        if (overlay != null) {
            return overlay; // overlay exists
        }
        overlay = this.addNewOverlay(layerData);
        this.storedOverlays.push(layerData);
        this.storedOverlays = this.unique(this.storedOverlays);
        return overlay;
    }

    private addNewOverlay = (layerData: Common.LayerData): IOverlay => {
        let overlay = { ...layerData } as IOverlay;
        overlay.layer = L.tileLayer(overlay.address, this.createOptionsFromLayerData(layerData))
            .setZIndex(this.overlayZIndex++);
        overlay.visible = false;
        overlay.isEditable = true;
        this.overlays.push(overlay);
        return overlay;
    }

    public updateBaseLayer = (oldLayer: IBaseLayer, newLayer: Common.LayerData): string => {
        if (oldLayer.key !== newLayer.key &&
            _.find(this.baseLayers, bl => bl.key.toLocaleLowerCase() === newLayer.key.toLocaleLowerCase()) != null) {
            return `The name: '${newLayer.key}' is already in use.`;
        }
        let position = this.baseLayers.indexOf(_.find(this.baseLayers, bl => bl.key === oldLayer.key));
        this.removeBaseLayer(oldLayer);
        var layer = this.addBaseLayer(newLayer, null, position);
        this.selectBaseLayer(layer);
        return "";
    }

    public updateOverlay = (oldLayer: IOverlay, newLayer: Common.LayerData) => {
        if (oldLayer.key !== newLayer.key &&
            _.find(this.overlays, o => o.key.toLocaleLowerCase() === newLayer.key.toLocaleLowerCase()) != null) {
            return `The name: '${newLayer.key}' is already in use.`;
        }
        this.removeOverlay(oldLayer);
        var overlay = this.addOverlay(newLayer);
        this.toggleOverlay(overlay);
        return "";
    }

    public removeBaseLayer = (baseLayer: IBaseLayer) => {
        _.remove(this.storedBaseLayers, (layerData) => layerData.key === baseLayer.key);
        this.storedBaseLayers = this.unique(this.storedBaseLayers);
        if (this.selectedBaseLayer.key !== baseLayer.key) {
            _.remove(this.baseLayers, (layer) => baseLayer.key === layer.key);
            return;
        }
        var index = this.baseLayers.indexOf(this.selectedBaseLayer);
        index = (index + 1) % this.baseLayers.length;
        this.selectBaseLayer(this.baseLayers[index]);
        _.remove(this.baseLayers, (layer) => baseLayer.key === layer.key);
        if (this.baseLayers.length === 0) {
            this.mapService.map.removeLayer(baseLayer.layer);
            this.selectedBaseLayer = null;
        }
    }

    public removeOverlay = (overlay: IOverlay) => {
        _.remove(this.storedOverlays, (layerData) => layerData.key === overlay.key);
        this.storedOverlays = this.unique(this.storedOverlays);
        if (overlay.visible) {
            this.toggleOverlay(overlay);
        }
        _.remove(this.overlays, (overlayToRemove) => overlayToRemove.key === overlay.key);
    }

    public selectBaseLayer = (baseLayer: IBaseLayer) => {
        if (baseLayer.selected) {
            return;
        }
        if (this.selectedBaseLayer) {
            this.mapService.map.removeLayer(this.selectedBaseLayer.layer);
            this.selectedBaseLayer.selected = false;
        }
        var newSelectedLayer = _.find(this.baseLayers, (layer) => layer.key === baseLayer.key);
        this.mapService.map.addLayer(newSelectedLayer.layer);
        newSelectedLayer.selected = true;
        this.selectedBaseLayer = newSelectedLayer;

        this.selectedBaseLayerKey = this.selectedBaseLayer.key;
    }

    public toggleOverlay = (overlay: IOverlay) => {
        var overlayFromArray = _.find(this.overlays, (overlayToFind) => overlayToFind.key === overlay.key);
        overlayFromArray.visible = !overlayFromArray.visible;
        if (overlayFromArray.visible) {
            this.mapService.map.addLayer(overlay.layer);
            if (_.find(this.activeOverlayKeys, (keyToFind) => keyToFind === overlay.key) == null) {
                this.activeOverlayKeys.push(overlay.key);
            }
        } else {
            this.mapService.map.removeLayer(overlay.layer);
            if (_.find(this.activeOverlayKeys, (keyToFind) => keyToFind === overlay.key) != null) {
                _.remove(this.activeOverlayKeys, (keyToFind) => keyToFind === overlay.key);
                this.activeOverlayKeys = this.activeOverlayKeys;
            }
        }
    }

    private addLayersFromLocalStorage = () => {
        for (let baseLayerIndex = 0; baseLayerIndex < this.storedBaseLayers.length; baseLayerIndex++) {
            let baseLayer = this.storedBaseLayers[baseLayerIndex] as ILayer;
            baseLayer.isEditable = true;
            var layer = _.find(this.baseLayers, (layerToFind) => layerToFind.key.toLocaleLowerCase() === baseLayer.key.toLocaleLowerCase());
            if (layer != null) {
                continue; // layer exists
            }
            this.addNewBaseLayer(baseLayer);
        }
        
        for (let overlayIndex = 0; overlayIndex < this.storedOverlays.length; overlayIndex++) {
            let overlayData = this.storedOverlays[overlayIndex] as ILayer;
            overlayData.isEditable = true;
            var overlay = _.find(this.overlays, (overlayToFind) => overlayToFind.key.toLocaleLowerCase() === overlayData.key.toLocaleLowerCase());
            if (overlay != null) {
                continue; // overlay exists
            }
            this.addNewOverlay(overlayData);
        }

        for (let overlayKey of this.activeOverlayKeys) {
            let overlay = _.find(this.overlays, overlayToFind => overlayToFind.key === overlayKey);
            if (overlay && overlay.visible === false) {
                this.toggleOverlay(overlay);
            }
        }
    }

    public addExternalBaseLayer = (layerData: Common.LayerData) => {
        if (layerData == null || (layerData.address === "" && layerData.key === "")) {
            let baseLayerToActivate = _.find(this.baseLayers, baseToFind => baseToFind.key === this.selectedBaseLayerKey);
            if (baseLayerToActivate) {
                this.selectBaseLayer(baseLayerToActivate);
            } else {
                this.selectBaseLayer(this.baseLayers[0]);
            }
            return;
        }
        var baseLayer = _.find(this.baseLayers, (baseLayerToFind) =>
            baseLayerToFind.address.toLocaleLowerCase() === layerData.address.toLocaleLowerCase() ||
            baseLayerToFind.key.toLocaleLowerCase() === layerData.key.toLocaleLowerCase());
        if (baseLayer != null) {
            this.selectBaseLayer(baseLayer);
            return;
        }
        var key = layerData.key;
        if (key === "") {
            key = LayersService.CUSTOM_LAYER + " ";
            let index = 0;
            let layer: IBaseLayer;
            let customName: string;
            do {
                index++;
                customName = key + index.toString();
                layer = _.find(this.baseLayers, (baseLayerToFind) => baseLayerToFind.key === customName);
            } while (layer != null);
            key = customName;
            layerData.minZoom = LayersService.MIN_ZOOM;
            layerData.maxZoom = LayersService.MAX_NATIVE_ZOOM;
        }

        var newLayer = this.addBaseLayer({
            key: key,
            address: layerData.address,
            minZoom: layerData.minZoom,
            maxZoom: layerData.maxZoom,
            isEditable: true
        } as ILayer);
        this.selectBaseLayer(newLayer);
    }

    public addExternalOverlays = (overlays: Common.LayerData[]) => {
        if (!overlays || overlays.length === 0) {
            return;
        }
        for (let overlayIndex = 0; overlayIndex < overlays.length; overlayIndex++) {
            let overlay = this.addOverlay(overlays[overlayIndex]);
            if (overlay.visible === false) {
                this.toggleOverlay(overlay);
            }
        }
    }

    private unique(layers: Common.LayerData[]): Common.LayerData[] {
        var layersMap = {};
        return layers.reverse().filter((layer) => {
            if (layersMap[layer.key.toLowerCase()]) {
                return false;
            }
            layersMap[layer.key.toLowerCase()] = true;
            return true;
        });
    }

    private createOptionsFromLayerData = (layerData: Common.LayerData, attribution?: string): L.TileLayerOptions => {
        return {
            minZoom: layerData.minZoom || LayersService.MIN_ZOOM,
            maxNativeZoom: layerData.maxZoom || LayersService.MAX_NATIVE_ZOOM,
            maxZoom: LayersService.MAX_ZOOM,
            attribution: attribution || LayersService.ATTRIBUTION
        } as L.TileLayerOptions;
    }

    public getData = (): Common.DataContainer => {
        var container = {
            baseLayer: null,
            overlays: []
        } as Common.DataContainer;

        container.baseLayer = this.extractDataFromLayer(this.selectedBaseLayer);
        var visibaleOverlays = this.overlays.filter(overlay => overlay.visible);
        for (let overlayIndex = 0; overlayIndex < visibaleOverlays.length; overlayIndex++) {
            container.overlays.push(this.extractDataFromLayer(visibaleOverlays[overlayIndex]));
        }
        return container;
    }

    private extractDataFromLayer = (layer: ILayer): Common.LayerData => {
        return {
            key: layer.key,
            address: layer.address,
            minZoom: layer.minZoom,
            maxZoom: layer.maxZoom
        } as Common.LayerData;
    }

    private changeLanguage() {
        let ihmLayer = _.find(this.baseLayers, bl => bl.key === LayersService.ISRAEL_HIKING_MAP);
        this.replaceBaseLayerAddress(ihmLayer,
            this.resourcesService.currentLanguage.tilesFolder + Urls.DEFAULT_TILES_ADDRESS,
            LayersService.ATTRIBUTION, 0);
        let mtbLayer = _.find(this.baseLayers, bl => bl.key === LayersService.ISRAEL_MTB_MAP);
        this.replaceBaseLayerAddress(mtbLayer,
            this.resourcesService.currentLanguage.tilesFolder + Urls.MTB_TILES_ADDRESS,
            LayersService.MTB_ATTRIBUTION, 1);
    }

    private replaceBaseLayerAddress(layer: IBaseLayer, newAddress: string, attribution: string, position: number) {
        _.remove(this.baseLayers, (layerToRemove) => layer.key === layerToRemove.key);
        if (this.selectedBaseLayer != null && this.selectedBaseLayer.key === layer.key) {
            this.mapService.map.removeLayer(layer.layer);
        }
        layer.layer = null;
        layer.address = newAddress;
        layer.selected = false;
        let newLayer = this.addBaseLayer(layer, attribution, position);
        if (this.selectedBaseLayer != null && this.selectedBaseLayer.key === layer.key) {
            this.selectedBaseLayer = null;
            this.selectBaseLayer(newLayer);
        }
    }
}
