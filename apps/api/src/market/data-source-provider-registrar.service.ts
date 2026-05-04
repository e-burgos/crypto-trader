import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSourceRegistryService } from './data-source-registry.service';
import {
  AlternativeMeProvider,
  CoinalyzeProvider,
  DefiLlamaProvider,
  FinnhubProvider,
  CoinGeckoProvider,
  PolymarketProvider,
  MessariProvider,
  AltFinsProvider,
} from '@crypto-trader/providers';

/**
 * Registers all concrete data source providers with the registry on startup.
 */
@Injectable()
export class DataSourceProviderRegistrar implements OnModuleInit {
  constructor(private readonly registry: DataSourceRegistryService) {}

  onModuleInit() {
    this.registry.registerProvider(new AlternativeMeProvider());
    this.registry.registerProvider(new CoinalyzeProvider());
    this.registry.registerProvider(new DefiLlamaProvider());
    this.registry.registerProvider(new FinnhubProvider());
    this.registry.registerProvider(new CoinGeckoProvider());
    this.registry.registerProvider(new PolymarketProvider());
    this.registry.registerProvider(new MessariProvider());
    this.registry.registerProvider(new AltFinsProvider());
  }
}
