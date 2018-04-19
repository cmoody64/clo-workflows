import RootStore from "./RootStore"
import { action, ObservableMap, observable, runInAction, computed, toJS, IKeyValueMap } from "mobx"
import {
    FormEntryType,
    CloRequestElement,
    FormControl,
    IFormControl,
    IStep,
    StepName,
    getNextStepName,
    View,
    INote,
    NoteSource,
    NoteScope,
} from "../model"
import { getView, getStep, getViewAndMakeReadonly, getStepById, getStepForProcessFieldName } from "../model/loader"
import { autobind } from "core-decorators"
import { IListItem } from "../component/NonScrollableList"
import { IBreadcrumbItem } from "office-ui-fabric-react/lib/Breadcrumb"
import Utils from "../utils"
import { IDataService, ListName } from "../service/dataService/IDataService"
import StoreUtils from "./StoreUtils"

// stores all in-progress projects, processes, and works that belong the current employee's steps
@autobind
export default class EmployeeStore {
    constructor(private root: RootStore, private dataService: IDataService) {}

    @action
    async init(): Promise<void> {
        const currentUser = this.root.sessionStore.currentUser
        const activeProcessList = await this.dataService.fetchEmployeeActiveProcesses(currentUser)
        this.activeProcesses = StoreUtils.mapRequestElementArrayById(activeProcessList)

        const activeProjectList = await this.dataService.fetchRequestElementsById(
            activeProcessList.map(process => Number(process.projectId)),
            ListName.PROJECTS
        )
        this.activeProjects = StoreUtils.mapRequestElementArrayById(activeProjectList)

        const activeWorkList = await this.dataService.fetchRequestElementsById(
            activeProcessList.map(process => Number(process.workId)),
            ListName.WORKS
        )
        this.activeWorks = StoreUtils.mapRequestElementArrayById(activeWorkList)

        this.selectedProject = observable.map()
        this.selectedWork = observable.map()
        this.selectedProcess = observable.map()

        this.setAsyncPendingLockout(false)
    }

    /*******************************************************************************************************/
    // WORKS
    /*******************************************************************************************************/
    @observable activeWorks: ObservableMap<CloRequestElement>
    @observable searchedWorks: ObservableMap<CloRequestElement>
    @observable selectedWork: ObservableMap<FormEntryType>
    @observable canEditSelectedWork: boolean = false

    @computed
    get selectedWorkView(): View {
        if (this.selectedWork) {
            return this.canEditSelectedWork
                ? getView(this.selectedWork.get("type") as string)
                : getViewAndMakeReadonly(this.selectedWork.get("type") as string)
        }
    }

    @action
    updateSelectedWork(fieldName: string, newVal: FormEntryType): void {
        this.selectedWork.set(fieldName, String(newVal))
    }

    @observable selectedWorkNotes: Array<INote> = []

    @action
    async submitSelectedWork(): Promise<void> {
        this.selectedWorkView.touchAllRequiredFormControls()
        if (!this.canSubmitSelectedWork) {
            this.postMessage({ messageText: "please fix all form errors", messageType: "error" })
            return
        }

        try {
            this.setAsyncPendingLockout(true)
            const updatedWork = this.selectedWork.toJS() as CloRequestElement
            await this.dataService.updateRequestElement(updatedWork, ListName.WORKS)
            this.activeWorks.set(String(updatedWork.Id), updatedWork)
            this.postMessage({ messageText: "work successfully submitted", messageType: "success" })
            runInAction(() => (this.canEditSelectedWork = false))
        } catch (error) {
            console.log(error)
            this.postMessage({ messageText: "there was a problem submitting your work, try again", messageType: "error" })
        } finally {
            this.setAsyncPendingLockout(false)
        }
    }

    @computed
    get canSubmitSelectedWork(): boolean {
        return !this.asyncPendingLockout && Utils.isObjectEmpty(this.selectedWorkValidation) && this.isSelectedRequestActive
    }

    @action
    startEditingSelectedWork() {
        this.canEditSelectedWork = true
    }
    @action
    stopEditingSelectedWork() {
        this.canEditSelectedWork = false
        this.resetSelectedWork()
    }

    @computed
    get selectedWorkValidation(): {} {
        return StoreUtils.validateFormControlGroup(this.selectedWorkView.formControls, this.selectedWork)
    }

    @action
    resetSelectedWork() {
        this.selectedWork = observable.map(this.activeWorks.get(this.selectedProcess.get("workId") as string))
    }

    /*******************************************************************************************************/
    // PROJECTS
    /*******************************************************************************************************/
    @observable activeProjects: ObservableMap<CloRequestElement>
    @observable searchedProjects: ObservableMap<CloRequestElement>
    @observable selectedProject: ObservableMap<FormEntryType>
    @observable canEditSelectedProject: boolean = false

    @computed
    get selectedProjectView(): View {
        if (this.selectedProject) {
            return this.canEditSelectedProject
                ? getView(this.selectedProject.get("type") as string)
                : getViewAndMakeReadonly(this.selectedProject.get("type") as string)
        }
    }

    @action
    updateSelectedProject(fieldName: string, newVal: FormEntryType): void {
        this.selectedProject.set(fieldName, String(newVal))
    }

    @observable selectedProjectNotes: Array<INote> = []

    @action
    async submitSelectedProject(): Promise<void> {
        this.selectedProjectView.touchAllRequiredFormControls()
        if (!this.canSubmitSelectedProject) {
            this.postMessage({ messageText: "please fix all form errors", messageType: "error" })
            return
        }

        try {
            this.setAsyncPendingLockout(true)
            const updatedProject = this.selectedProject.toJS() as CloRequestElement
            await this.dataService.updateRequestElement(updatedProject, ListName.PROJECTS)
            this.activeProjects.set(String(updatedProject.Id), updatedProject)
            this.postMessage({ messageText: "project successfully submitted", messageType: "success" })
            runInAction(() => (this.canEditSelectedProject = false))
        } catch (error) {
            console.log(error)
            this.postMessage({ messageText: "there was a problem submitting your project, try again", messageType: "error" })
        } finally {
            this.setAsyncPendingLockout(false)
        }
    }

    @computed
    get canSubmitSelectedProject(): boolean {
        return !this.asyncPendingLockout && Utils.isObjectEmpty(this.selectedProjectValidation) && this.isSelectedRequestActive
    }

    @action
    toggleCanEditSelectedProject() {
        this.canEditSelectedProject = !this.canEditSelectedProject
    }

    @computed
    get selectedProjectValidation(): {} {
        return StoreUtils.validateFormControlGroup(this.selectedProjectView.formControls, this.selectedProject)
    }

    @action
    resetSelectedProject() {
        this.selectedProject = observable.map(this.activeProjects.get(this.selectedProcess.get("projectId") as string))
    }

    @action
    startEditingSelectedProject() {
        this.canEditSelectedProject = true
    }
    @action
    stopEditingSelectedProject() {
        this.canEditSelectedProject = false
        this.resetSelectedProject()
    }

    /*******************************************************************************************************/
    // STEPS
    /*******************************************************************************************************/
    @observable focusStep: IStep
    @action
    selectFocusStep(step: IStep): void {
        this.unfocusSearch()
        this.focusStep = step
    }
    @computed
    get isFocusStep(): boolean {
        return !!this.focusStep
    }
    @action
    private unfocusStep(): void {
        this.focusStep = null
    }

    /*******************************************************************************************************/
    // PROCESSES
    /*******************************************************************************************************/
    @observable activeProcesses: ObservableMap<CloRequestElement>
    @observable searchedProcesses: ObservableMap<CloRequestElement>
    @observable selectedProcess: ObservableMap<FormEntryType>

    // TODO project lookup should be more efficient, store as map ?
    @action
    async selectActiveProcess(itemBrief: IListItem): Promise<void> {
        return await this.selectProcess(itemBrief, this.activeProcesses, this.activeWorks, this.activeProjects)
    }
    @computed
    get isSelectedRequestActive(): boolean {
        // note: only if the request originated from the focus step can it be active (as opposed to a past searchedProcess)
        return this.selectedProcess && this.isFocusStep
    }

    getSelectedProcessSubmissionMetadata(formControl: IFormControl): string {
        const parentStep = getStepForProcessFieldName(formControl.dataRef)
        const submitter = this.selectedProcess.get(parentStep.submitterFieldName)
        const submissionDate = this.selectedProcess.get(parentStep.submissionDateFieldName)
        if (submitter && submissionDate) {
            return `submitted by ${submitter} on ${submissionDate}`
        } else {
            return null
        }
    }

    @action
    updateSelectedProcess(fieldName: string, newVal: FormEntryType): void {
        this.selectedProcess.set(fieldName, String(newVal))
    }

    @action
    async submitSelectedProcess(): Promise<void> {
        this.selectedProcessView.touchAllRequiredFormControls()
        if (!this.canSubmitSelectedProcess) {
            this.postMessage({ messageText: "please fix all form errors", messageType: "error" })
            return
        }

        try {
            this.setAsyncPendingLockout(true)
            const currentStep = getStep(this.selectedProcess.get("step") as StepName)
            let updatedProcess = this.selectedProcess.toJS() as CloRequestElement
            updatedProcess = {
                ...updatedProcess,
                ...{
                    step: getNextStepName(updatedProcess),
                    [currentStep.submissionDateFieldName]: Utils.getFormattedDate(),
                    [currentStep.submitterFieldName]: this.root.sessionStore.currentUser.name,
                },
            }
            await this.dataService.updateRequestElement(updatedProcess, ListName.PROCESSES)
            // replace cached process with successfully submitted selectedProcess
            this.activeProcesses.set(String(updatedProcess.Id), updatedProcess)

            this.reduceViewHierarchy(EmployeeViewKey.Dashboard)
            this.clearSelectedRequestElements()
            this.postMessage({ messageText: "process successfully submitted", messageType: "success" })
        } catch (error) {
            console.log(error)
            this.postMessage({ messageText: "there was a problem submitting your process, try again", messageType: "error" })
        } finally {
            this.setAsyncPendingLockout(false)
        }
    }

    @computed
    get canSubmitSelectedProcess(): boolean {
        return !this.asyncPendingLockout && Utils.isObjectEmpty(this.selectedProcessValidation) && this.isSelectedRequestActive
    }

    @computed
    get selectedProcessValidation(): {} {
        return StoreUtils.validateFormControlGroup(this.selectedProcessView.formControls, this.selectedProcess)
    }

    // computes a plain JavaScript object mapping step names process counts
    @computed
    get processCountsByStep(): { [stepName: string]: number } {
        return this.activeProcesses.values().reduce((accumulator: any, process) => {
            const stepName: string = process.step as string
            accumulator[stepName] !== undefined ? accumulator[stepName]++ : (accumulator[stepName] = 1)
            return accumulator
        }, {})
    }

    @computed
    private get selectedStepProcesses(): ObservableMap<CloRequestElement> {
        if (this.focusStep) {
            const filteredProcesses = this.activeProcesses.values().filter(process => process.step === this.focusStep.name)
            return StoreUtils.mapRequestElementArrayById(filteredProcesses)
        }
    }

    @computed
    get selectedProcessView(): View {
        if (this.isFocusStep) return getView(this.focusStep.view)
        else if (this.isFocusSearch) return getView("Complete")
    }

    @computed
    get selectedStepProcessBriefs(): Array<IListItem> {
        return EmployeeStore.getProcessBriefsFromRequestElements(this.selectedStepProcesses, this.activeWorks, this.activeProjects)
    }

    // searches past processes by title - populates searchedWorks, searchedProcesses, and searchedProject arrays
    @action
    async searchProcesses(searchTerm: string) {
        const processes = await this.dataService.searchProcessesByTitle(searchTerm)
        const works = await this.dataService.fetchRequestElementsById(processes.map(proc => Number(proc.workId)), ListName.WORKS)
        const projects = await this.dataService.fetchRequestElementsById(processes.map(proc => Number(proc.projectId)), ListName.PROJECTS)
        this.unfocusStep()
        runInAction(() => {
            this.searchedProcesses = StoreUtils.mapRequestElementArrayById(processes)
            this.searchedWorks = StoreUtils.mapRequestElementArrayById(works)
            this.searchedProjects = StoreUtils.mapRequestElementArrayById(projects)
        })
    }
    @action
    private unfocusSearch(): void {
        this.searchedProcesses = null
        this.searchedProjects = null
        this.searchedWorks = null
    }
    @computed
    get isFocusSearch(): boolean {
        return !!(this.searchedProcesses && this.searchedProjects && this.searchedWorks)
    }
    @computed
    get searchedProcessBriefs(): Array<IListItem> {
        // extract request element objects from each request element map and transform objects into request briefs
        // request briefs are small summaries of a request that contain information about the work, process, and project
        return EmployeeStore.getProcessBriefsFromRequestElements(this.searchedProcesses, this.searchedWorks, this.searchedProjects)
    }
    @action
    async selectSearchedProcess(itemBrief: IListItem): Promise<void> {
        return await this.selectProcess(itemBrief, this.searchedProcesses, this.searchedWorks, this.searchedProjects)
    }

    @action
    private async selectProcess(
        selectedProcessBrief: IListItem,
        processesMap: ObservableMap<CloRequestElement>,
        worksMap: ObservableMap<CloRequestElement>,
        projectsMap: ObservableMap<CloRequestElement>
    ): Promise<void> {
        const selectedProcess: CloRequestElement = processesMap.get(String(selectedProcessBrief.id))
        this.selectedProcess = observable.map(selectedProcess)
        this.extendViewHierarchy(EmployeeViewKey.ProcessDetail)

        const selectedWork = worksMap.get(this.selectedProcess.get("workId") as string)
        this.selectedWork = observable.map(selectedWork)

        const selectedProject = projectsMap.get(this.selectedProcess.get("projectId") as string)
        this.selectedProject = observable.map(selectedProject)

        const workNotes = await this.dataService.fetchNotes(
            NoteSource.WORK,
            NoteScope.EMPLOYEE,
            this.selectedWork.get("Id") as string,
            this.selectedProcess.get("submitterId") as string
        )
        const projectNotes = await this.dataService.fetchNotes(
            NoteSource.PROJECT,
            NoteScope.EMPLOYEE,
            this.selectedProject.get("Id") as string,
            this.selectedProcess.get("submitterId") as string
        )
        runInAction(() => {
            this.selectedWorkNotes = workNotes
            this.selectedProjectNotes = projectNotes
        })
    }

    private static getProcessBriefsFromRequestElements(
        processesMap: ObservableMap<CloRequestElement>,
        worksMap: ObservableMap<CloRequestElement>,
        projectsMap: ObservableMap<CloRequestElement>
    ): Array<IListItem> {
        if (processesMap && worksMap && projectsMap) {
            return processesMap.values().map(process => {
                const processWork = worksMap.get(process.workId as string)
                const processProject = projectsMap.get(process.projectId as string)
                // to get the date when the process arrived at the current step for processing, look at the previous step submission date
                const currentStep = getStep(process.step as StepName)
                const previousStep = getStepById(currentStep.orderId - 1)
                const submissionDateAtCurrentStep = currentStep && process[previousStep.submissionDateFieldName]
                return {
                    header: `${processProject.department || ""} ${processWork.type || ""} Process`,
                    subheader: `submitted to ${process.step} on ${
                        submissionDateAtCurrentStep ? submissionDateAtCurrentStep : "an unknown date"
                    }`,
                    body: `${processWork.Title} - ${processWork.authorName ||
                        processWork.artist ||
                        processWork.composer ||
                        "unknown artist"}`,
                    id: process.Id as number,
                    selectable: true,
                }
            })
        }
    }

    /*******************************************************************************************************/
    // NOTES - SHARED BY PROJECTS AND WORKS
    /*******************************************************************************************************/
    @action
    async submitNewNote(noteToCreate: INote, noteSource: NoteSource): Promise<boolean> {
        this.setAsyncPendingLockout(true)

        let submissionStatus = true
        try {
            // fill in any info the new note needs before submission
            noteToCreate.dateSubmitted = Utils.getFormattedDate()
            noteToCreate.submitter = this.root.sessionStore.currentUser.name
            if (noteToCreate.scope === NoteScope.CLIENT) {
                noteToCreate.attachedClientId = this.selectedProcess.get("submitterId") as string
            }

            if (noteSource === NoteSource.PROJECT) {
                noteToCreate.projectId = String(this.selectedProject.get("Id"))
            } else if (noteSource === NoteSource.WORK) {
                noteToCreate.workId = String(this.selectedWork.get("Id"))
            }

            const addResult = await this.dataService.createNote(noteToCreate)
            noteToCreate.Id = addResult.data.Id // assign the assigned SP ID to the newly created note

            // if submission is successful, add the new note to the corresponding list
            if (noteSource === NoteSource.WORK) runInAction(() => this.selectedWorkNotes.unshift(noteToCreate))
            if (noteSource === NoteSource.PROJECT) runInAction(() => this.selectedProjectNotes.unshift(noteToCreate))
            this.postMessage({ messageText: "note successfully submitted", messageType: "success" })
        } catch (error) {
            console.error(error)
            submissionStatus = false
            this.postMessage({ messageText: "there was a problem submitting your note, try again", messageType: "error" })
        } finally {
            this.setAsyncPendingLockout(false)
        }

        return submissionStatus
    }

    @action
    async updateNote(noteToUpdate: INote, noteSource: NoteSource): Promise<boolean> {
        this.setAsyncPendingLockout(true)
        let submissionStatus = true
        try {
            noteToUpdate.dateSubmitted = Utils.getFormattedDate()
            await this.dataService.updateNote(noteToUpdate)

            // if submission is successful, add the new note to the corresponding list
            if (noteSource === NoteSource.WORK) StoreUtils.replaceElementInListById(noteToUpdate, this.selectedWorkNotes)
            if (noteSource === NoteSource.PROJECT) StoreUtils.replaceElementInListById(noteToUpdate, this.selectedProjectNotes)

            this.postMessage({ messageText: "note successfully updated", messageType: "success" })
        } catch (error) {
            console.error(error)
            submissionStatus = false
            this.postMessage({ messageText: "there was a problem updating your note, try again", messageType: "error" })
        } finally {
            this.setAsyncPendingLockout(false)
        }

        return submissionStatus
    }

    @action
    async deleteNote(noteToDelete: INote, noteSource: NoteSource): Promise<boolean> {
        this.setAsyncPendingLockout(true)
        let submissionStatus = true

        try {
            await this.dataService.deleteNote(noteToDelete.Id)

            // if deletion is successful, remove the new note from the corresponding list
            if (noteSource === NoteSource.PROJECT) this.removeELementInListById(noteToDelete, this.selectedProjectNotes)
            if (noteSource === NoteSource.WORK) this.removeELementInListById(noteToDelete, this.selectedWorkNotes)
            this.postMessage({ messageText: "note successfully deleted", messageType: "success" })
        } catch (error) {
            console.error(error)
            submissionStatus = false
            this.postMessage({ messageText: "there was a problem deleting your note, try again", messageType: "error" })
        } finally {
            this.setAsyncPendingLockout(false)
        }
        return submissionStatus
    }

    /*******************************************************************************************************/
    // VIEWS
    // the view heirarchy refers to nested pages an employee has visited within the page heirarchy
    // the first view in the array is the "home" page, the last view in the array is the currently viewed page
    // The hierarchy is as follows:
    //      Dashboard -> ProcessDetail
    @observable viewHierarchy: Array<EmployeeViewKey> = [EmployeeViewKey.Dashboard]

    @computed
    get currentView(): EmployeeViewKey {
        return this.viewHierarchy[this.viewHierarchy.length - 1]
    }

    @action
    reduceViewHierarchy(viewKeyString: string) {
        this.viewHierarchy = this.viewHierarchy.slice(0, this.viewHierarchy.indexOf(viewKeyString as EmployeeViewKey) + 1)
    }

    @action
    extendViewHierarchy(viewKey: EmployeeViewKey) {
        this.viewHierarchy.push(viewKey)
    }

    @computed
    get breadcrumbItems(): Array<IBreadcrumbItem> {
        return this.viewHierarchy.map(viewKey => {
            let text: string
            if (viewKey === EmployeeViewKey.Dashboard) text = "Processor Dashboard"
            else if (viewKey === EmployeeViewKey.ProcessDetail)
                text = `${this.selectedProcess.get("type") || ""} Process ${this.selectedProcess.get("Id") || ""} Detail`

            return {
                text,
                key: viewKey,
                onClick: () => this.reduceViewHierarchy(viewKey),
                isCurrentItem: viewKey === this.currentView,
            }
        })
    }

    // current state of the projectWork pivot => is either "project" (show project detail) or "work" (show work detail)
    @observable projectWorkPivotSelection = "work"
    @action
    setProjectWorkPivotSelection(selection) {
        this.projectWorkPivotSelection = selection
        // if switching away from a pivot selection, reinitialize it from the original copy
        if (selection === "project") {
            this.resetSelectedWork()
            this.canEditSelectedWork = false
        } else if (selection === "work") {
            this.resetSelectedProject()
            this.canEditSelectedProject = false
        }
    }
    @observable clientMode: boolean = false
    @action toggleClientMode = () => this.clientMode = !this.clientMode

    /*******************************************************************************************************/
    // MISCELLANEOUS MEMBERS AND HELPER METHODS
    /*******************************************************************************************************/
    @observable asyncPendingLockout: boolean
    @action
    setAsyncPendingLockout(val: boolean) {
        this.asyncPendingLockout = val
    }

    @observable message: IMessage
    @action
    postMessage(message: IMessage, displayTime: number = 5000) {
        this.message = message
        setTimeout(
            action(() => {
                this.message = null
            }),
            displayTime
        )
    }

    @action
    private clearSelectedRequestElements(): void {
        this.selectedProcess = null
        this.selectedProject = null
        this.selectedWork = null
    }

    @action
    private removeELementInListById(itemToDelete: CloRequestElement | INote, list: Array<CloRequestElement | INote>) {
        list.splice(list.findIndex(listItem => listItem["Id"] === listItem["Id"]), 1 /*remove 1 elem*/)
    }
}

export enum EmployeeViewKey {
    Dashboard = "DASHBOARD",
    ProcessDetail = "PROCESS_DETAIL",
}

interface IMessage {
    messageText: string
    messageType: "error" | "success"
}
