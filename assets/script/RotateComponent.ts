import { _decorator, Component, Node, Vec3} from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RatateComponent')
export class RatateComponent extends Component {
    private rotation : Vec3 = new Vec3(1,1,1);
    start() {

    }

    update(deltaTime: number) {
        this.node.setRotationFromEuler(this.rotation);
        this.rotation.add3f(0.1, 0.3, 0.2)
    }
}

