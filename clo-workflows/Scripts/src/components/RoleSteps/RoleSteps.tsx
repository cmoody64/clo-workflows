import * as React from "react"
import { SessionStore, EmployeeStore } from "../../store/"
import { inject } from "mobx-react"
import { observer } from "mobx-react"
import { autobind } from "core-decorators"
import { CompoundButton, IButtonProps } from "office-ui-fabric-react/lib/Button"
import { IStep } from "../../model"

import "./styles.css"

@inject("rootStore")
@autobind
@observer
export default class RoleSteps extends React.Component<any, any> {
    public componentWillMount() {
        this.sessionStore = this.props.rootStore.sessionStore
        this.employeeStore = this.props.rootStore.employeeStore
    }

    private sessionStore: SessionStore
    private employeeStore: EmployeeStore

    private onStepButtonClick(step: IStep): void {
        this.employeeStore.selectFocusStep(step)
    }

    public render() {
        const { sessionStore, employeeStore } = this
        return (
            <div className="roleSteps-wrapper-styles">
                <div className="roleSteps-stepButtonRow-styles">
                    {// first map each role to a new role row (as long as that role has a nonzero number of permitted steps)
                    sessionStore.currentUser.roles.filter(role => !!role.permittedSteps.length).map((role, index) => (
                        <div key={index}>
                            <div className="roleSteps-roleTitle-styles">{`${role.name} Steps`}</div>
                            {// within each role row, map each permitted step to a step button
                            role.permittedSteps.map((step: IStep, innerIndex: number) => {
                                const pendingItemCount = employeeStore.processCountsByStep[step.name]
                                    ? employeeStore.processCountsByStep[step.name]
                                    : 0
                                return (
                                    <CompoundButton
                                        onClick={() => this.onStepButtonClick(step)}
                                        key={innerIndex}
                                        className="roleSteps-stepButton-styles"
                                        description={`${pendingItemCount} Pending Item${pendingItemCount !== 1 ? "s" : ""}`}
                                        primary={!!pendingItemCount}
                                        text={step.name}
                                        checked={employeeStore.focusStep && step.name === employeeStore.focusStep.name}
                                    />
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>
        )
    }
}