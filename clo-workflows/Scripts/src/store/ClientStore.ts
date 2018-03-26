import { action, ObservableMap, observable, runInAction, computed, IObservableArray } from "mobx"
import { autobind } from "core-decorators"
import { FormEntryType, CloRequestElement, PROJECT_TYPES, WORK_TYPES } from "../model/CloRequestElement"
import { IFormControl } from "../model/FormControl"
import { getView, getStep, getStepNames } from "../model/loader/resourceLoaders"
import { IDataService } from "../service/dataService/IDataService"
import { validateFormControl } from "../utils"
import { RootStore } from "./RootStore"
import { User, IUser } from "../model/User"
import { getNextStepName, StepName } from "../model/Step"
import { IWork } from "../model/Work"
import { IProjectGroup } from "../component/ProjectProcessList"
import { ObservableArray } from "mobx/lib/types/observablearray"
import { View } from "./View"

type ClientObsMap = ObservableMap<FormEntryType>

@autobind
export class ClientStore {
    @observable message: any
    @observable currentUser: IUser = this.root.sessionStore.currentUser
    /* Observable maps to store the info entered that is not state */
    @observable newProject: ClientObsMap = this.getClientObsMap()
    @observable newProcess: ClientObsMap = this.getClientObsMap()
    @observable newWork: ClientObsMap = this.getClientObsMap()
    /* fetched data */
    @observable projects: Array<any> = observable.array()
    @observable processes: Array<any> = []
    @observable works: Array<any> = observable.array()
    /* Object used to store all view related state */
    view: View = new View()

    constructor(private root: RootStore, private dataService: IDataService) {}

    @action
    async init(): Promise<void> {
        this.currentUser = this.root.sessionStore.currentUser
        await this.fetchClientProcesses()
        await this.fetchClientProjects()
        await this.fetchWorks()
    }
    /************************************************
     * ##### Overview #####
     * # View related
     * # utility functions
     * # dataService interactions
     ************************************************/

    /********** View updates and storage **********/

    /* function to update view state on this.view */
    @action updateView = (m: string, v: string | boolean) => (this.view[m] = v)
    /* this replaces the entire cirrent view with a new instance */
    @action clearView = () => (this.view = new View())

    @action
    private postMessage(message: any, displayTime: number = 5000) {
        this.message = message
        setTimeout(
            action(() => {
                this.message = null
            }),
            displayTime
        )
    }
    /************ Computed Values ****************/
    @computed
    get currentForm(): Array<IFormControl> {
        return getView(this.view.workType || this.view.projectType).formControls
    }

    @computed
    get currentFormValidation(): {} {
        const typeToValidate = this.currentForm
        const newInstanceOfType = this.newWork || this.newProject
        return typeToValidate.reduce((accumulator: {}, formControl: IFormControl) => {
            const fieldName: string = formControl.dataRef
            const inputVal = newInstanceOfType.get(fieldName) || undefined
            const error: string = inputVal ? validateFormControl(formControl, inputVal) : null
            accumulator[fieldName] = error
            return accumulator
        }, {})
    }

    @computed
    get clientProcesses() {
        return this.processes.sort((a, b) => Number(a.projectId) - Number(b.projectId))
    }

    @computed
    get clientProjects() {
        return this.projects
    }

    @computed
    get typesAsOptions() {
        return {
            PROJECTS: PROJECT_TYPES.map(e => ({
                key: e,
                text: e,
            })),
            WORKS: WORK_TYPES.map(e => ({
                key: e,
                text: e,
            })),
        }
    }
    /* function to update class members of type ObservableMap */
    @action
    async updateClientStoreMember(fieldName: string, newVal: FormEntryType | boolean, objToUpdate?: string) {
        objToUpdate ? this[objToUpdate].set(fieldName, newVal) : (this[fieldName] = newVal)
    }

    @action
    async processClientRequest() {
        this.view.projectType
            ? await this.submitProject()
            : this.view.workIsNew ? (await this.submitWork(), await this.submitProcess()) : await this.submitProcess()
        this.view = new View()
    }

    @action
    handleAddNewProcess(projectId: string) {
        this.newProcess.set("projectId", projectId)
        this.updateView("showProcessModal", true)
    }

    @action
    private cleanProjects = projects => {
        this.projects = projects
            .map((proj: CloRequestElement, i): IProjectGroup => ({
                key: i.toString(),
                projectId: proj.Id.toString(),
                Title: proj.Title.toString(),
                name: proj.Title.toString(),
                count: this.getProcessCount(proj),
                submitterId: proj.submitterId.toString(),
                startIndex: 0,
                isShowingAll: false,
            }))
            .map((e, i, a) => {
                i > 0 ? (e.startIndex = a[i - 1].count + a[i - 1].startIndex) : (e.startIndex = 0)
                return e
            })
    }

    @action
    private getProcessCount(proj: CloRequestElement) {
        const id = proj.Id ? proj.Id : proj.projectId
        return this.clientProcesses.filter(proc => {
            return id.toString() === proc.projectId
        }).length
    }

    @action
    private fetchClientProcesses = async () => {
        const processes = await this.dataService.fetchClientProcesses(this.currentUser.Id)
        this.processes = observable.array(
            processes.map((proc, i) => {
                return {
                    key: i.toString(),
                    Id: proc.Id,
                    projectId: proc.projectId,
                    title: proc.Title,
                    step: `${proc.step} - ${getStep(proc.step as StepName).stepId} out of ${getStepNames().length}`,
                }
            })
        )
    }

    @action private fetchClientProjects = async () => this.cleanProjects(await this.dataService.fetchClientProjects(this.currentUser.Id))

    @action
    private fetchWorks = async () => {
        this.works = observable.array(await this.dataService.fetchWorks())
    }

    @action
    private async submitProject(): Promise<void> {
        this.updateView("asyncPendingLockout", true)
        this.newProject.set("type", this.view.projectType)
        try {
            await this.dataService.createProject(this.newProject.toJS())
            // runInAction(() => this.projects.push(projectDetails))
            this.postMessage({ messageText: "project successfully created", messageType: "success" })
        } catch (error) {
            console.error(error)
            this.postMessage({ messageText: "there was a problem creating your new Project, try again", messageType: "error" })
        } finally {
            this.updateView("asyncPendingLockout", false)
        }
    }

    @action
    private async submitWork(): Promise<void> {
        this.updateView("asyncPendingLockout", true)
        try {
            this.newWork.set("type", this.view.workType)
            const work = await this.dataService.createWork(this.newWork.toJS())
            this.updateClientStoreMember("selectedWorkId", work.data.Id.toString())
        } catch (error) {
            console.error(error)
            this.postMessage({
                messageText: "there was a problem submitting your new Process request, try again",
                messageType: "error",
            })
        } finally {
            this.updateView("asyncPendingLockout", false)
        }
    }

    @action
    private async submitProcess(): Promise<void> {
        this.updateView("asyncPendingLockout", true)
        try {
            // processDetails.step = getNextStepName(processDetails, "Intake")
            this.newProcess.set("step", "Intake")
            this.view.workIsNew
                ? this.newProcess.set("Title", this.newWork.get("Title"))
                : this.newProcess.set("Title", this.works.find(work => work.Id.toString() === this.view.workId).Title)
            this.newProcess.set("workId", this.view.workId)
            await this.dataService.createProcess(this.newProcess.toJS())
            this.postMessage({
                messageText: "the new Process request was submitted successfully",
                messageType: "success",
            })
        } catch (error) {
            console.error(error)
            this.postMessage({
                messageText: "there was a problem submitting your new Process request, try again",
                messageType: "error",
            })
        } finally {
            this.updateView("asyncPendingLockout", false)
            runInAction(() => this.processes.push(this.newProcess.toJS()))
            this.updateView("showProcessModal", false)
        }
    }

    // finds the item with the with the same ID as the new item and replaces the stale item with the new item
    // true if replacement was successfull, false if not (stale list item was not found)
    @action
    private replaceElementInListById(newItem: CloRequestElement, list: Array<any>): boolean {
        const staleItemIndex = list.findIndex(listItem => listItem.Id === newItem.Id)

        if (staleItemIndex !== -1) {
            list[staleItemIndex] = newItem
            return true
        }
        return false
    }

    private getClientObsMap(): ClientObsMap {
        return observable.map([["submitterId", this.currentUser.Id]])
    }
}
