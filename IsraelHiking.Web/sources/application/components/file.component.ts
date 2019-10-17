import { Component, HostListener, ViewChild, ElementRef } from "@angular/core";
import { every } from "lodash";

import { DataContainerService } from "../services/data-container.service";
import { ResourcesService } from "../services/resources.service";
import { FileService } from "../services/file.service";
import { ToastService } from "../services/toast.service";
import { BaseMapComponent } from "./base-map.component";
import { DataContainer } from "../models/models";
import { RunningContextService } from "../services/running-context.service";
import { DatabaseService } from "../services/database.service";

@Component({
    selector: "file",
    templateUrl: "./file.component.html"
})
export class FileComponent extends BaseMapComponent {

    @ViewChild("openFile", { static: false })
    public openFileElement: ElementRef;

    constructor(resources: ResourcesService,
                private readonly dataContainerService: DataContainerService,
                private readonly fileService: FileService,
                private readonly toastService: ToastService,
                private readonly runningContextService: RunningContextService,
                private readonly databaseService: DatabaseService
    ) {
        super(resources);
    }

    public async open(e: any) {
        let file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        if (file.name.endsWith(".ihm")) {
            this.toastService.info("Opening file, this might take a while, please don't close the app...");
            await this.fileService.openIHMfile(file, this.progressCallbackForIhmFileOpening);
            this.toastService.confirm({ type: "Ok", message: "Finished opening file." });
            return;
        }
        if (file.name.endsWith(".pois")) {
            this.toastService.info("Opening file, this might take a while, please don't close the app...");
            await new Promise((resolve, reject) => {
                let reader = new FileReader();
                reader.onload = (event: any) => {
                    let pois = JSON.parse(event.target.result);
                    this.databaseService.storePois(pois);
                    resolve();
                };
                reader.onerror = () => reject();
                reader.readAsText(file);
            });
            this.toastService.confirm({ type: "Ok", message: "Finished opening file." });
            return;
        }
        try {
            await this.fileService.addRoutesFromFile(file);
        } catch (ex) {
            this.toastService.error(this.resources.unableToLoadFromFile);
        }
    }

    private progressCallbackForIhmFileOpening = async (message: string, address: string, content: string) => {
        try {
            if (!address || !content) {
                this.toastService.info(message);
                return;
            }
            let dbName = this.databaseService.getDbNameFromUrl(address);
            await this.databaseService.saveTilesContent(dbName, content);
            this.toastService.info(message);
        } catch (ex) {
            this.toastService.error(ex.toString());
        }
    }

    public async save() {
        let data = this.dataContainerService.getDataForFileExport();
        if (!this.isDataSaveable(data)) {
            return;
        }
        try {
            let showToast = await this.fileService.saveToFile(this.getName(data) + ".gpx", "gpx", data);
            if (showToast) {
                this.toastService.success(this.resources.fileSavedSuccessfully);
            }
        } catch (ex) {
            this.toastService.error(this.resources.unableToSaveToFile);
        }
    }

    private getName(data: DataContainer): string {
        let name = "IsraelHikingMap";
        if (data.routes.length === 1 && data.routes[0].name) {
            name = data.routes[0].name;
        }
        return name;
    }

    private isDataSaveable(data: DataContainer): boolean {
        if (data.routes.length === 0) {
            this.toastService.warning(this.resources.unableToSaveAnEmptyRoute);
            return false;
        }
        if (every(data.routes, r => r.segments.length === 0 && r.markers.length === 0)) {
            this.toastService.warning(this.resources.unableToSaveAnEmptyRoute);
            return false;
        }
        return true;
    }

    public print() {
        window.print();
    }

    public showPrint(): boolean {
        return !this.runningContextService.isMobile;
    }

    @HostListener("window:keydown", ["$event"])
    public onFileShortcutKeys($event: KeyboardEvent) {
        if ($event.ctrlKey === false) {
            return true;
        }
        if ($event.key == null) {
            return true;
        }
        switch ($event.key.toLowerCase()) {
            case "o":
                // this doesn't work on firefox due to security reasons. it does work in chrome and IE though.
                this.openFileElement.nativeElement.click();
                break;
            case "s":
                this.save();
                break;
            case "p":
                this.print();
                break;
            default:
                return true;
        }
        return true;
    }
}
