// Empêche l'ouverture d'une console Windows supplémentaire en mode release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    jeccam_ecole_lib::run();
}
