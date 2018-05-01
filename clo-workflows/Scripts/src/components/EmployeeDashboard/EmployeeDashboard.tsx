import * as React from "react"
import { observer, inject } from "mobx-react"
import { EmployeeStore } from "../../store/"
import { NonScrollableList, RoleSteps, ProcessBriefList } from "../"
import { PrimaryButton } from "office-ui-fabric-react/lib/Button"
import { SearchBox } from "office-ui-fabric-react"
import "./styles.css"

@inject("rootStore")
@observer
export default class EmployeeDashboard extends React.Component<any, any> {
    public componentWillMount() {
        this.employeeStore = this.props.rootStore.employeeStore
    }

    private employeeStore: EmployeeStore

    public render() {
        const { employeeStore } = this
        return (
            <div>
                <RoleSteps />
                <div className="searchProcess-styles">
                    <div className="searchProcess-title-styles">Search Past Processes</div>
                    <div className="searchProcess-searchbox-styles">
                        <SearchBox placeholder="search by work or project" onSearch={employeeStore.searchProcesses} />
                    </div>
                </div>
                {employeeStore.isFocusStep && (
                    <ProcessBriefList
                        processBriefs={employeeStore.selectedStepProcessBriefs}
                        title={`${employeeStore.focusStep.name} Active Processes`}
                        emptyMessage="no active processes"
                        onSelectProcessBrief={employeeStore.selectActiveDetailProcess}
                    />
                )}
                {employeeStore.isFocusSearch && (
                    <ProcessBriefList
                        processBriefs={employeeStore.searchedProcessBriefs}
                        title="Search Results"
                        emptyMessage="no processes found"
                        onSelectProcessBrief={employeeStore.selectSearchedDetailProcess}
                    />
                )}
            </div>
        )
    }
}