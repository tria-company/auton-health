import { useState, useEffect, useCallback } from 'react';

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export interface MediaDevicesState {
  audioInputs: DeviceInfo[];
  videoInputs: DeviceInfo[];
  audioOutputs: DeviceInfo[];
  selectedAudioInputId: string | null;
  selectedVideoInputId: string | null;
  selectedAudioOutputId: string | null;
  permissionGranted: boolean;
}

export function useMediaDevices() {
  const [devices, setDevices] = useState<MediaDevicesState>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
    selectedAudioInputId: null,
    selectedVideoInputId: null,
    selectedAudioOutputId: null,
    permissionGranted: false,
  });

  const getDevices = useCallback(async () => {
    try {
      // Ensure we have permissions first to get labels
      // Note: We don't call getUserMedia here to avoid interrupting existing streams
      // We rely on the main component to have requested permissions initially.

      const deviceInfos = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = deviceInfos
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microfone ${d.deviceId.slice(0, 5)}...`, kind: d.kind }));

      const videoInputs = deviceInfos
        .filter(d => d.kind === 'videoinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Câmera ${d.deviceId.slice(0, 5)}...`, kind: d.kind }));

      const audioOutputs = deviceInfos
        .filter(d => d.kind === 'audiooutput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Alto-falante ${d.deviceId.slice(0, 5)}...`, kind: d.kind }));

      setDevices(prev => ({
        ...prev,
        audioInputs,
        videoInputs,
        audioOutputs,
        // Preserve selection or default to first available
        selectedAudioInputId: prev.selectedAudioInputId || (audioInputs[0]?.deviceId ?? null),
        selectedVideoInputId: prev.selectedVideoInputId || (videoInputs[0]?.deviceId ?? null),
        selectedAudioOutputId: prev.selectedAudioOutputId || (audioOutputs[0]?.deviceId ?? null),
        permissionGranted: audioInputs.some(d => d.label) // Heuristic: if we have labels, permission is likely granted
      }));

    } catch (error) {
      console.error('Error enumerating devices:', error);
    }
  }, []);

  useEffect(() => {
    getDevices();

    const handleDeviceChange = () => {
      console.log('🎧 [DeviceManager] Dispositivos alterados! Atualizando lista...');
      getDevices();
      // Optional: Add logic here to auto-select a new device if the current one was removed
      // For now, getDevices() preserves selection if still valid, or defaults to first.
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [getDevices]);

  const selectAudioInput = (deviceId: string) => {
    setDevices(prev => ({ ...prev, selectedAudioInputId: deviceId }));
  };

  const selectVideoInput = (deviceId: string) => {
    setDevices(prev => ({ ...prev, selectedVideoInputId: deviceId }));
  };

  const selectAudioOutput = (deviceId: string) => {
    setDevices(prev => ({ ...prev, selectedAudioOutputId: deviceId }));
  };

  return {
    ...devices,
    refreshDevices: getDevices,
    selectAudioInput,
    selectVideoInput,
    selectAudioOutput
  };
}
