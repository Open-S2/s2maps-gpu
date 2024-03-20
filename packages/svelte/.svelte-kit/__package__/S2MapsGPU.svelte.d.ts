import { SvelteComponent } from "svelte";
import type { MapOptions, S2Map } from '../../../../s2/maps-gpu';
declare const __propDef: {
    props: {
        mapOptions: MapOptions;
        version: string;
        build?: "flat" | "preloaded" | "prod" | "dev" | undefined;
        testing?: boolean | undefined;
        mapReady?: ((s2map: S2Map) => void) | undefined;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        default: {};
    };
};
export type S2MapsGpuProps = typeof __propDef.props;
export type S2MapsGpuEvents = typeof __propDef.events;
export type S2MapsGpuSlots = typeof __propDef.slots;
export default class S2MapsGpu extends SvelteComponent<S2MapsGpuProps, S2MapsGpuEvents, S2MapsGpuSlots> {
}
export {};
