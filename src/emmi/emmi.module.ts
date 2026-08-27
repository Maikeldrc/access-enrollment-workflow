// Framework-neutral starter. Adapt imports/decorators to the API framework in use.

import { EmmiService } from "./emmi.service";

export class EmmiModule {
  readonly service = new EmmiService();
}
