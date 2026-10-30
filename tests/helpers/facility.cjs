'use strict';

// Synthetic fixtures may provision pre-owned space directly. Product code must
// use construction quotes/actions; this helper is never imported by the runtime.
function grantSpace(state, options = {}) {
  const count = options.rooms ?? Math.max(1, Math.ceil(state.facility.racks.length / 6));
  state.facility.building = {
    version: 1,
    floors: options.floors ?? Math.ceil(count / 4),
    rooms: Array.from({ length: count }, (_, index) => ({
      id: `room-${index + 1}`,
      floor: Math.floor(index / 4) + 1,
    })),
    specialRooms: [...(options.specialRooms ?? state.facility.building?.specialRooms ?? [])],
    project: null,
  };
  state.facility.racks.forEach((rack, index) => {
    rack.roomId = `room-${Math.floor(index / 6) + 1}`;
  });
  return state;
}

function serviceRoomsAt(sector) {
  return [
    'control',
    ...(sector >= 4 ? ['cooling'] : []),
    ...(sector >= 6 ? ['ups'] : []),
    ...(sector >= 8 ? ['distribution'] : []),
  ];
}
module.exports = { grantSpace, serviceRoomsAt };
