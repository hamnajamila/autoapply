import type { BasePortal } from "./BasePortal";
import { LinkedInPortal } from "./LinkedInPortal";
import { JobRightPortal } from "./JobRightPortal";
import { MercorPortal } from "./MercorPortal";
import { RemoteOKPortal } from "./RemoteOKPortal";
import { RemotivePortal } from "./RemotivePortal";
import { WeWorkRemotelyPortal } from "./WeWorkRemotelyPortal";
import { HimalayasPortal } from "./HimalayasPortal";
import { WellfoundPortal } from "./WellfoundPortal";
import { GreenhousePortal } from "./GreenhousePortal";
import { LeverPortal } from "./LeverPortal";
import { WorkdayPortal } from "./WorkdayPortal";
import { RemoteCoPortal } from "./RemoteCoPortal";

type PortalFactory = () => BasePortal;

export class PortalRegistry {
  private static factories: Record<string, PortalFactory> = {
    linkedin: () => new LinkedInPortal(),
    jobright: () => new JobRightPortal(),
    mercor: () => new MercorPortal(),
    remoteok: () => new RemoteOKPortal(),
    remotive: () => new RemotivePortal(),
    weworkremotely: () => new WeWorkRemotelyPortal(),
    himalayas: () => new HimalayasPortal(),
    wellfound: () => new WellfoundPortal(),
    greenhouse: () => new GreenhousePortal(),
    lever: () => new LeverPortal(),
    workday: () => new WorkdayPortal(),
    remoteco: () => new RemoteCoPortal()
  };

  static allPortalNames(): string[] {
    return Object.keys(this.factories);
  }

  static get(portalName: string): BasePortal {
    const key = portalName.toLowerCase();
    const factory = this.factories[key];
    if (!factory) throw new Error(`Unknown portal: ${portalName}`);
    return factory();
  }
}

