import * as React from "react"
import { observer } from "mobx-react"
import { autobind } from "core-decorators"
import { List } from "office-ui-fabric-react/lib/List"
import Header from "./Header"

export interface IItemBrief {
    header: string
    subheader?: string
    body: string
    id: string | number
}

interface INonScrollableListProps {
    items: Array<IItemBrief>
    style?: {}
    // NOTE selectable and onClick item will only if both are present
    selectable?: boolean
    onClickItem?: (itemBrief: IItemBrief) => void
}

interface IProcessListState {
    hoverItemIndex: number
}

const listItemStyles = {
    borderBottom: "1px inset #505050",
    padding: "13 0",
}

const listStyles = { maxWidth: 400, padding: 0 }
const listItemBodyStyles = { font: "18px Segoe UI, sans-serif" }

const listItemHeaderStyles = {
    font: "20px Segoe UI, sans-serif",
    color: "#202020",
    fontWeight: 200,
} as React.CSSProperties

const listItemSubheaderStyles = {
    font: "12px Segoe UI, sans-serif",
    color: "#A9A9A9",
    marginBottom: 10,
}

@autobind
@observer
export class NonScrollableList extends React.Component<INonScrollableListProps, IProcessListState> {
    constructor(props) {
        super(props)
        this.state = { hoverItemIndex: -1 }
    }

    public render() {
        const { props } = this
        return (
            <div style={this.props.style}>
                <ul style={listStyles}>
                {
                    props.items.map((item, index) => (
                        <div key={index}
                            style={this.getListItemStyle(index)}
                            onMouseLeave={props.selectable ? this.onMouseLeaveListItem : null}
                            onMouseEnter={props.selectable ? () => this.onMouseEnterListItem(index) : null}
                            onClick={props.selectable && props.onClickItem ? () => this.props.onClickItem(item) : null}
                        >
                            <div style={listItemHeaderStyles}>{item.header}</div>
                            <div style={listItemSubheaderStyles}>{item.subheader}</div>
                            <div>{item.body}</div>
                        </div>
                    ))
                }
                </ul>
            </div>
        )
    }

    private getListItemStyle(index: number) {
        return this.state.hoverItemIndex === index ? {...listItemStyles, ...{backgroundColor: "#F5F5F5", cursor: "pointer"}} : listItemStyles
    }

    private onMouseLeaveListItem() {
        this.setState({ hoverItemIndex: -1 })
    }

    private onMouseEnterListItem(index: number) {
        this.setState({ hoverItemIndex: index })
    }
}