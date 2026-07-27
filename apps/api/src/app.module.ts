import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RecipesModule } from './recipes/recipes.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Use local env files first; .env.example remains template-only.
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const explicitUri = configService.get<string>('MONGODB_URI')?.trim();
        if (explicitUri) {
          return { uri: explicitUri };
        }

        const mongoEnv = (configService.get<string>('MONGO_ENV') ?? 'local')
          .trim()
          .toLowerCase();

        if (mongoEnv === 'atlas') {
          const atlasUri = configService.get<string>('MONGODB_ATLAS_URI')?.trim();
          if (!atlasUri) {
            throw new Error(
              'MONGO_ENV=atlas je ukljucen, ali MONGODB_ATLAS_URI nije podesena.',
            );
          }
          return { uri: atlasUri };
        }

        const localUri =
          configService.get<string>('MONGODB_LOCAL_URI')?.trim() ??
          'mongodb://127.0.0.1:27017/new-folder';

        return { uri: localUri };
      },
    }),
    AuthModule,
    RecipesModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
