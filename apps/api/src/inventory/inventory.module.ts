import { Module } from '@nestjs/common';

import { FifoService } from './fifo.service';

import { EightySixService } from './eighty-six.service';

import { InventoryController } from './inventory.controller';

import { InventoryOpsService } from './inventory-ops.service';



@Module({

  controllers: [InventoryController],

  providers: [FifoService, EightySixService, InventoryOpsService],

  exports: [FifoService, EightySixService, InventoryOpsService],

})

export class InventoryModule {}


