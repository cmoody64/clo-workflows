import { RootStore } from "./RootStore"
import { AsyncService } from "../service/AsyncService"
import { IUser } from "../model/User"
import { observable, action } from "mobx"

export class UserStore {
    constructor(
        private root: RootStore,
        private asyncService: AsyncService,
    ) {}

    @observable currentUser: IUser

    @action async initData() {
        this.currentUser = await this.asyncService.fetchUser()
    }
}
