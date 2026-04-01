<template>
  <div class="container mx-auto p-4 max-w-3xl space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold">Manage Vehicles</h1>
      <Button @click="$router.push('/vehicles/new')">Add Vehicle</Button>
    </div>

    <div v-if="vehiclesStore.loading" class="text-center py-8 text-muted-foreground">
      Loading vehicles...
    </div>

    <div v-else>
      <div v-if="vehiclesStore.vehicles.length === 0" class="text-center py-8 text-muted-foreground">
        You don't have any vehicles yet. Add your first vehicle to get started.
      </div>

      <div
        v-else
        class="grid gap-4 md:grid-cols-2"
      >
        <Card
          v-for="vehicle in vehiclesStore.vehicles"
          :key="vehicle.id"
          class="p-4 flex flex-col justify-between"
        >
          <div>
            <h2 class="text-lg font-semibold">
              {{ vehicle.make || 'Unknown' }} {{ vehicle.model || '' }}
            </h2>
            <p class="text-sm text-muted-foreground">
              {{ vehicle.year || 'N/A' }}
              •
              {{ vehicle.odometer_unit_default === 'km' ? 'Kilometers' : 'Miles' }}
            </p>
            <p v-if="vehicle.vrm" class="text-xs text-muted-foreground mt-1">
              VRM: {{ vehicle.vrm }}
            </p>
          </div>
          <div class="flex gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              @click="$router.push(`/vehicles/${vehicle.id}/edit`)"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              @click="confirmDelete(vehicle.id)"
            >
              Delete
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useVehiclesStore } from '@/stores/vehicles';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const vehiclesStore = useVehiclesStore();

onMounted(async () => {
  if (vehiclesStore.vehicles.length === 0) {
    await vehiclesStore.fetchVehicles();
  }
});

async function confirmDelete(id: string) {
  if (!window.confirm('Are you sure you want to delete this vehicle? This cannot be undone.')) {
    return;
  }
  await vehiclesStore.deleteVehicle(id);
}
</script>

