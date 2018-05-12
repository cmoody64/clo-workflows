import * as React from "react"
import * as ReactDom from "react-dom"
import { useStrict } from "mobx"
import { App } from "./components/"
import { Provider } from "mobx-react"
import { RootStore } from "./store/"
import { DataServiceFactory } from "./service/"
import "./styles.css"
import { EnvType, ENVIRONMENT } from "./env"
// in strict mode, mobx requires that all observable data members only be modified through explicit @action mutators
useStrict(true)

const root = document.getElementById("root")

const rootStore = new RootStore(DataServiceFactory.getDataService())

// TODO remove window rootStore reference
window["rootStore"] = rootStore

ReactDom.render(
    <Provider rootStore={rootStore}>
        <App />
    </Provider>,
    root
)
rootStore.init()
