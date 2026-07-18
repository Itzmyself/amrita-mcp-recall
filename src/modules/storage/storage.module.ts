@Module({
  name: 'recall',
  description: 'Memory agent for capturing and recalling student observations',
  imports: [StorageModule],
  providers: [ObservationService],
  exports: [ObservationService],
})
export class RecallModule {
  constructor(private observationService: ObservationService) {}

  // Provide access to tools, resources, prompts through getters or static methods
}
