"""Plain-language notes for satellites.

Launch dates, orbits, and object class come from the CelesTrak satellite
catalog. Purpose notes are limited to missions that have a public description.
A rocket body, a piece of debris, or a classified satellite is described as
that, without invented instruments.
"""

from __future__ import annotations

from datetime import date, datetime

_MONTHS = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)

_SITES = {
    "AFETR": "Cape Canaveral",
    "AFWTR": "Vandenberg",
    "FRGUI": "Kourou",
    "JSC": "Jiuquan",
    "PLMSC": "Plesetsk",
    "RLLB": "the Mahia Peninsula",
    "SRILR": "Sriharikota",
    "TAISC": "Taiyuan",
    "TANSC": "Tanegashima",
    "TYMSC": "Baikonur",
    "WRAS": "the Western Range",
    "WSC": "Wenchang",
    "XICLF": "Xichang",
}

_OWNERS = {
    "US": "the United States",
    "CIS": "Russia",
    "PRC": "China",
    "JPN": "Japan",
    "ESA": "the European Space Agency",
    "FR": "France",
    "IT": "Italy",
    "ARGN": "Argentina",
    "IND": "India",
    "ISS": "the International Space Station partnership",
    "CA": "Canada",
    "THAI": "Thailand",
    "MEX": "Mexico",
}

# Keyed by NORAD catalog number. {launched} is filled from the catalog.
_NOTES = {
    25544: {
        "role": "Crewed station",
        "about": "The International Space Station is a crewed laboratory in low Earth orbit. The catalog tracks the whole station under Zarya, the first module, launched on {launched}. Later modules were added to it.",
        "facts": [
            "Zarya carries propulsion and power. Around it are laboratories, long solar wings, and docking ports for crew and cargo ships.",
            "It can outshine every star on a pass. The light is steady, and it does not twinkle.",
        ],
    },
    36086: {
        "role": "Station module",
        "about": "Poisk is a Russian module on the International Space Station, launched on {launched}. Crew and cargo ships dock to it, and spacewalkers use it as an airlock.",
        "facts": [
            "It is a small research and docking module, not a free-flying satellite.",
        ],
    },
    49044: {
        "role": "Station laboratory",
        "about": "Nauka is the Russian laboratory module on the International Space Station, launched on {launched}. It added a science lab, crew space, a docking port, and the European Robotic Arm.",
        "facts": [
            "The arm walks on the Russian segment and can move experiments and spacewalkers.",
        ],
    },
    48274: {
        "role": "Crewed station",
        "about": "Tianhe is the core module of Tiangong, China’s space station, launched on {launched}. The crew live here. It provides the station’s guidance, propulsion, and life support.",
        "facts": [
            "Wentian and Mengtian, the two laboratories, are docked to it, and crew and cargo ships come and go from its ports.",
        ],
    },
    53239: {
        "role": "Station laboratory",
        "about": "Wentian is a science laboratory docked to Tiangong, launched on {launched}. It carries experiment racks, an airlock for spacewalks, and extra solar arrays.",
        "facts": [
            "The airlock is where crew members leave the station in their suits.",
        ],
    },
    54216: {
        "role": "Station laboratory",
        "about": "Mengtian is the second science laboratory on Tiangong, launched on {launched}. It holds experiment racks and a cargo airlock that can put equipment outside.",
        "facts": [
            "The cargo airlock moves experiments into open space without a spacewalk.",
        ],
    },
    66515: {
        "role": "Crew ship module",
        "about": "This is the orbital module of Shenzhou-21, the cabin of a Chinese crew ship left in orbit after the reentry capsule comes home. Shenzhou-21 launched on {launched}. The catalog does not list the experiments on this flight.",
        "facts": [
            "A Shenzhou has three parts: this orbital module, the capsule that returns the crew, and a service module with the engine and solar arrays.",
        ],
    },
    68837: {
        "role": "Cargo ship",
        "about": "Progress MS-34 is an uncrewed Russian cargo ship, launched on {launched}. It brings fuel, water, food, and air, and its engine can raise the station’s orbit.",
        "facts": [
            "It is a freighter. It has tanks and a cargo compartment, not a telescope or a science camera.",
        ],
    },
    100712: {
        "role": "Cargo ship",
        "about": "Progress MS-35 is an uncrewed Russian cargo ship, launched on {launched}. It brings fuel, water, food, and air, and its engine can raise the station’s orbit.",
        "facts": [
            "It is a freighter. It has tanks and a cargo compartment, not a telescope or a science camera.",
        ],
    },
    69049: {
        "role": "Cargo ship",
        "about": "Tianzhou-10 is a Chinese cargo ship, launched on {launched}. It carries supplies and propellant to Tiangong, and it can refuel the station and raise its orbit.",
        "facts": [
            "The pressurized cabin holds cargo. Propellant tanks feed the station. It is not an observatory.",
        ],
    },
    69180: {
        "role": "Crew ship",
        "about": "Shenzhou-23 is a Chinese crew ship, launched on {launched}. It has an orbital module where the crew can work, a reentry capsule that brings them home, and a service module with the engine and solar arrays.",
        "facts": [
            "The capsule is the part that survives reentry. The other two modules do not come home.",
        ],
    },
    100057: {
        "role": "Crew ship",
        "about": "Soyuz MS-29 is a Russian crew ship, launched on {launched}. It has a descent module for the ride home, an orbital module, and a service module with solar arrays and the engine.",
        "facts": [
            "The descent module is the only part built to come back through the atmosphere.",
        ],
    },
    100882: {
        "role": "Crew ship",
        "about": "Crew Dragon 13 is a SpaceX crew ship, launched on {launched}. The capsule is a pressurized cabin with seats. Draco thrusters maneuver it, and SuperDraco thrusters are there for a launch abort.",
        "facts": [
            "The trunk carries the solar arrays and is discarded before the capsule reenters. The trunk does not come home.",
        ],
    },
    101031: {
        "role": "Cargo ship",
        "about": "Dragon CRS-35 is a SpaceX cargo ship, launched on {launched}. The capsule holds pressurized cargo for the International Space Station. The trunk can hold unpressurized gear and carries the solar arrays.",
        "facts": [
            "It is a freighter. It has no crew seats and no science telescope.",
        ],
    },
    66906: {
        "role": "Propulsion test",
        "about": "DUPLEX is a NASA cubesat testing two small thrusters. It was released from the International Space Station on 2 December 2025.",
        "facts": [
            "One thruster is a pulsed plasma thruster that vaporizes a Teflon fiber with an electric pulse. The other heats a Delrin plastic fiber and vents the vapor, a tiny resistojet.",
            "Both are meant to raise and lower a small satellite’s orbit without a tank of pressurized fuel.",
        ],
    },
    67683: {
        "role": "Student satellite",
        "about": "KNACKSAT-2 is a Thai 3U cubesat from King Mongkut’s University of Technology North Bangkok. It was released from the Kibo module on 3 February 2026. It is a shared ride for several small experiments.",
        "facts": [
            "On board are a camera, an ultraviolet sensor, an X-ray and gamma-ray sensor, an amateur-radio digipeater, and a store-and-forward radio.",
        ],
    },
    67685: {
        "role": "Student satellite",
        "about": "Gxiba-1 is a Mexican 1U cubesat from the Universidad Popular Autónoma del Estado de Puebla. It was released from Kibo on 3 February 2026 to photograph active volcanoes, above all Popocatépetl.",
        "facts": [
            "A camera takes the pictures. They come down by Iridium and by amateur radio.",
        ],
    },
    67687: {
        "role": "Student satellite",
        "about": "LEOPARD is a 3U cubesat from the Kyushu Institute of Technology, released from Kibo on 3 February 2026. It is a bundle of small technology tests.",
        "facts": [
            "It carries a multispectral imager aimed at twilight airglow, a positioning experiment, a radiation-shielding test, a magnetic-field measurement, and a solar panel opened by a shape-memory alloy.",
        ],
    },
    67688: {
        "role": "Student satellite",
        "about": "HMU-SAT2, nicknamed Teruteru, is a 1U student cubesat led by the Hokkaido University of Science and Komagane Technical High School. It was released from Kibo on 3 February 2026.",
        "facts": [
            "LEDs on one face flash messages in Morse code, so people on the ground can see it and the team can try a simple optical link.",
        ],
    },
    49271: {
        "role": "Debris",
        "about": "This is a piece of debris from a Fregat upper stage, from a launch on {launched}. It is not a working satellite, and it carries no instruments.",
        "facts": [
            "A Fregat is a rocket stage used to finish putting satellites into orbit. This fragment is what the catalog still tracks.",
        ],
    },
    694: {
        "role": "Spent rocket stage",
        "about": "Atlas Centaur 2 is the Centaur upper stage from a 1963 test flight, left in orbit to prove the stage. It launched on {launched}. It is an empty rocket stage, not an observatory.",
        "facts": [
            "The flight’s payload was the stage itself. Nothing on it is still operating.",
        ],
    },
    27422: {
        "role": "Spent rocket stage",
        "about": "This is an Ariane 42P upper stage with two tiny amateur-radio transmitters, called Idefix, bolted to it. It launched on {launched} with the SPOT 5 imaging satellite. The transmitters ran on batteries and went silent within about a month.",
        "facts": [
            "What remains in orbit is the spent stage. The radios were an experiment in using a discarded stage as a short-lived carrier.",
        ],
    },
    20580: {
        "role": "Space telescope",
        "about": "The Hubble Space Telescope is an optical and ultraviolet observatory, launched on {launched} aboard the space shuttle Discovery. A 2.4-meter mirror feeds its cameras and spectrographs.",
        "facts": [
            "The instruments in use are the Wide Field Camera 3, the Advanced Camera for Surveys, the Cosmic Origins Spectrograph, and the Space Telescope Imaging Spectrograph.",
            "Shuttle crews repaired and upgraded it in orbit. It does not take the wide sky pictures used as this map’s background.",
        ],
    },
    25994: {
        "role": "Earth observatory",
        "about": "Terra is a NASA Earth satellite, launched on {launched}. It watches land, clouds, and the air.",
        "facts": [
            "ASTER and MODIS are cameras. MISR is nine cameras looking at different angles. CERES measures the energy Earth sends back to space. MOPITT measures carbon monoxide.",
        ],
    },
    27424: {
        "role": "Earth observatory",
        "about": "Aqua is a NASA satellite built to study Earth’s water, launched on {launched}. It watches the ocean, water vapor, clouds, and ice.",
        "facts": [
            "MODIS is a scanning camera. AIRS and AMSU sound the atmosphere. CERES measures Earth’s outgoing energy.",
            "Two earlier instruments, HSB and the AMSR-E microwave radiometer, have stopped working.",
        ],
    },
    27386: {
        "role": "Earth observatory",
        "about": "Envisat was a European Space Agency Earth satellite, launched on {launched}. Contact was lost in 2012, so it no longer returns data.",
        "facts": [
            "It carried ASAR, a radar, MERIS, an ocean-color camera, a radar altimeter, and three atmosphere instruments: SCIAMACHY, MIPAS, and GOMOS.",
        ],
    },
    21574: {
        "role": "Earth observatory",
        "about": "ERS-1 was a European radar satellite, launched on {launched}. The mission ended in 2000.",
        "facts": [
            "It carried a synthetic-aperture radar, a radar altimeter, a wind scatterometer, and an infrared radiometer called ATSR.",
        ],
    },
    10967: {
        "role": "Ocean radar",
        "about": "Seasat was NASA’s first radar satellite for the ocean, launched on {launched}. It failed after about 100 days, and it proved the idea.",
        "facts": [
            "On board were a synthetic-aperture radar, a radar altimeter, a wind scatterometer, and a microwave radiometer.",
        ],
    },
    24883: {
        "role": "Ocean color",
        "about": "OrbView-2, also called SeaStar, mapped the color of the ocean, launched on {launched} by a Pegasus rocket dropped from an airplane. The mission ended around 2010.",
        "facts": [
            "Its instrument was SeaWiFS, a camera that measured how green the water was, which traces plankton.",
        ],
    },
    28931: {
        "role": "Earth observatory",
        "about": "ALOS, also called Daichi, was a Japanese mapping satellite, launched on {launched}. Contact was lost in 2011.",
        "facts": [
            "PRISM was a stereo camera, AVNIR-2 a color camera, and PALSAR an L-band radar.",
        ],
    },
    39766: {
        "role": "Radar satellite",
        "about": "ALOS-2 is a Japanese radar satellite, launched on {launched}. It maps disasters, forests, and ground movement through cloud and darkness.",
        "facts": [
            "The instrument is PALSAR-2, an L-band synthetic-aperture radar.",
        ],
    },
    27597: {
        "role": "Earth observatory",
        "about": "Midori II, also called ADEOS-II, was a Japanese Earth satellite, launched on {launched}. It failed in October 2003.",
        "facts": [
            "It carried AMSR, a microwave radiometer, the GLI imager, the SeaWinds scatterometer, and atmosphere sensors.",
        ],
    },
    29228: {
        "role": "Earth observatory",
        "about": "Resurs-DK 1 is a Russian imaging satellite, launched on {launched}. It took detailed pictures of the ground and also carried particle detectors.",
        "facts": [
            "Geoton-1 is the camera. PAMELA hunted antimatter in cosmic rays. ARINA counted high-energy electrons and protons.",
        ],
    },
    31598: {
        "role": "Radar satellite",
        "about": "COSMO-SkyMed 1 is an Italian radar satellite, launched on {launched}. It serves both civil users and the military, and it sees through cloud.",
        "facts": [
            "The instrument is an X-band synthetic-aperture radar.",
        ],
    },
    43641: {
        "role": "Radar satellite",
        "about": "SAOCOM 1A is an Argentine radar satellite, launched on {launched}. It maps soil moisture, floods, and forests.",
        "facts": [
            "The instrument is an L-band synthetic-aperture radar.",
        ],
    },
    46265: {
        "role": "Radar satellite",
        "about": "SAOCOM 1B is the second Argentine radar satellite, launched on {launched}. It pairs with SAOCOM 1A so the same ground is seen more often.",
        "facts": [
            "The instrument is an L-band synthetic-aperture radar.",
        ],
    },
    3597: {
        "role": "Space telescope",
        "about": "OAO-2 was NASA’s first successful ultraviolet observatory, launched on {launched}. It stopped working in 1973.",
        "facts": [
            "It carried several ultraviolet telescopes, from the University of Wisconsin and the Smithsonian.",
        ],
    },
    6153: {
        "role": "Space telescope",
        "about": "OAO-3, named Copernicus, was an ultraviolet observatory, launched on {launched}.",
        "facts": [
            "The main telescope had an 80-centimeter mirror. A separate instrument watched the sky in X-rays.",
        ],
    },
    3669: {
        "role": "Ionosphere probe",
        "about": "ISIS 1 was a Canadian satellite for the ionosphere, launched on {launched}. ISIS stands for International Satellites for Ionospheric Studies.",
        "facts": [
            "Its main instrument was a swept-frequency radio sounder, which probed the ionosphere the way a radar probes the ground.",
        ],
    },
    4327: {
        "role": "Ion engine test",
        "about": "SERT 2 was a NASA test of electric rockets, launched on {launched}. SERT stands for Space Electric Rocket Test.",
        "facts": [
            "It carried two ion thrusters, which accelerate charged gas instead of burning fuel.",
        ],
    },
    5560: {
        "role": "Technology test",
        "about": "ASTEX was a United States Air Force technology satellite, launched on {launched}. The experiments ended in the 1970s.",
        "facts": [
            "It tested a roll-out solar array, an infrared scanner, and instruments that measured energetic particles in the ionosphere.",
        ],
    },
    16908: {
        "role": "Geodesy satellite",
        "about": "Ajisai, the Experimental Geodetic Satellite, is a mirrored ball launched on {launched}. Ground stations bounce laser beams off it to measure the shape of Earth.",
        "facts": [
            "The surface is covered with mirrors and laser retroreflectors. It has no camera and no science radio.",
        ],
    },
    41337: {
        "role": "X-ray telescope",
        "about": "Hitomi, also called ASTRO-H, was a Japanese X-ray observatory, launched on {launched}. It tumbled and was lost about five weeks later.",
        "facts": [
            "It carried a soft X-ray spectrometer, a soft X-ray camera, hard X-ray imagers, and a gamma-ray detector.",
        ],
    },
    57800: {
        "role": "X-ray telescope",
        "about": "XRISM is a Japanese and NASA X-ray observatory, launched on {launched}. It took up the science Hitomi was built for.",
        "facts": [
            "Resolve measures the energy of individual X-ray photons. Xtend is a wide-field X-ray camera.",
        ],
    },
    42758: {
        "role": "X-ray telescope",
        "about": "Insight, also called HXMT or Huiyan, is China’s X-ray telescope, launched on {launched}. It watches black holes, neutron stars, and bursts.",
        "facts": [
            "Three detector sets cover low-energy, medium-energy, and high-energy X-rays.",
        ],
    },
    33504: {
        "role": "Solar observatory",
        "about": "Koronas-Foton was a Russian solar observatory, launched on {launched}. It watched the Sun in X-rays and gamma rays, and contact was lost later in 2009.",
        "facts": [
            "The payload was aimed at the Sun, not at the ground.",
        ],
    },
    20261: {
        "role": "Magnetosphere probe",
        "about": "Intercosmos 24, the Aktivny mission, studied low-frequency radio waves in the magnetosphere. It launched on {launched} with a Czech subsatellite, Magion 2.",
        "facts": [
            "It carried a powerful radio transmitter and a loop antenna. The antenna did not deploy properly, so the transmitter was much weaker than planned.",
        ],
    },
    21819: {
        "role": "Ionosphere probe",
        "about": "Intercosmos 25, the APEX mission, fired beams of electrons and plasma into the ionosphere to see how it responded. It launched on {launched} and released the Czech subsatellite Magion 3.",
        "facts": [
            "The beams were the experiment. Magion 3 measured the effect from a short distance away.",
        ],
    },
    18187: {
        "role": "Reactor test",
        "about": "Cosmos 1867 was a Soviet test of a Topaz nuclear reactor and an electric plasma thruster, launched on {launched}. The test ended long ago, and the reactor was shut down.",
        "facts": [
            "Topaz turned reactor heat directly into electricity, without a spinning turbine. The plasma thruster used that power.",
        ],
    },
    21397: {
        "role": "Ocean satellite",
        "about": "Okean-3 is a Soviet ocean satellite, launched on {launched}. The Okean series watched sea ice and the ocean surface.",
        "facts": [
            "The public catalog does not itemize the radar and cameras on this particular flight.",
        ],
    },
    25860: {
        "role": "Ocean satellite",
        "about": "Okean-O is a Russian ocean satellite, launched on {launched}. It mapped sea ice and the ocean.",
        "facts": [
            "It carried a side-looking radar, microwave radiometers, and optical scanners.",
        ],
    },
    25977: {
        "role": "Reconnaissance satellite",
        "about": "Helios 1B is a French military reconnaissance satellite, launched on {launched}. It carried optical cameras.",
        "facts": [
            "The public catalog does not describe those cameras any further.",
        ],
    },
    59588: {
        "role": "Solar sail",
        "about": "ACS3 is NASA’s Advanced Composite Solar Sail System, launched on {launched} on an Electron rocket. The experiment is a sail deployed on lightweight composite booms.",
        "facts": [
            "Sunlight pushes on the sail. There is no telescope and no Earth camera.",
        ],
    },
}

_SPACEMOBILE = {
    "role": "Phone relay",
    "about": "{name} is a commercial satellite built by AST SpaceMobile to connect ordinary mobile phones, launched on {launched}.",
    "facts": [
        "The working part is a large antenna array that talks to phones on the ground. It is not a camera or a telescope.",
    ],
}


def satellite_story(catalog_id: str, name: str | None, record: dict | None) -> dict:
    """Card for one satellite: what it is, when it launched, and what it carries."""
    record = record or {}
    norad = int(str(catalog_id))
    label = name or f"NORAD {norad}"
    launched = _launched_phrase(record)
    note = _NOTES.get(norad)
    if note is None and label.upper().startswith("SPACEMOBILE"):
        note = _SPACEMOBILE
    if note:
        role = note["role"]
        about = note["about"].format(launched=launched, name=label)
        facts = [fact.format(launched=launched, name=label) for fact in note["facts"]]
    else:
        role, about, facts = _generic(label, record, launched)
    facts.extend(_common_facts(record, norad))
    about = _with_status(about, record)
    return {
        "constellation": role,
        "distance": _height_label(record.get("perigee_km"), record.get("apogee_km")),
        "about": about,
        "facts": [fact for fact in facts if fact],
    }


def _generic(label: str, record: dict, launched: str) -> tuple[str, str, list[str]]:
    kind = (record.get("object_class") or "").upper()
    upper = label.upper()
    if kind == "R/B" or "R/B" in upper:
        return (
            "Spent rocket stage",
            f"{label} is a spent rocket stage, the empty booster left in orbit after it delivered its satellite. It launched on {launched}. It has no science instruments of its own.",
            ["Sunlight can make a spent stage look like a bright steady light. It crosses the sky in a few minutes."],
        )
    if kind == "DEB" or " DEB" in f" {upper}":
        return (
            "Debris",
            f"{label} is a fragment from a launch, not a spacecraft. It dates to a launch on {launched}. It carries no instruments.",
            ["Debris drifts. It does not maneuver, and it does not send pictures or measurements."],
        )
    if upper.startswith("COSMOS ") or upper.startswith("KOSMOS "):
        return (
            "Satellite",
            f"{label} is a Soviet or Russian satellite launched on {launched}. Cosmos is the public name used for many military and scientific craft. This catalog does not list the instruments on this one.",
            ["Its light is steady, and it moves against the stars."],
        )
    if upper.startswith("USA "):
        return (
            "National-security satellite",
            f"{label} is a United States national-security satellite launched on {launched}. The public catalog gives the orbit and the launch, and it does not describe what is on board.",
            ["No public instrument list is available for this object."],
        )
    if upper.startswith("YAOGAN"):
        return (
            "Remote sensing",
            f"{label} is part of Yaogan, China’s series of remote-sensing satellites, launched on {launched}. The public catalog does not say whether this one carries a camera or a radar.",
            ["Yaogan missions are not described instrument by instrument in the open catalog."],
        )
    if upper.startswith("SHIJIAN") or upper.startswith("SJ-"):
        return (
            "Technology satellite",
            f"{label} is a Chinese technology satellite launched on {launched}. Shijian means practice. The public catalog does not describe the instruments.",
            ["The name covers technology tests, and the open catalog stops at the orbit."],
        )
    owner = _OWNERS.get((record.get("owner") or "").upper())
    owned = f" It is listed under {owner}." if owner else ""
    return (
        "Satellite",
        f"{label} is a satellite launched on {launched}.{owned} The public catalog gives the orbit and the launch date, and it does not describe the machinery on board.",
        ["Its place in the sky comes from published orbital elements."],
    )


def _common_facts(record: dict, norad: int) -> list[str]:
    facts = []
    designator = record.get("intl_desig") or ""
    if str(designator).startswith("1998-067") and norad != 25544:
        when = _long_date(record.get("launch_date"))
        if when:
            facts.append(
                f"The catalog dates the launch to {when} because that is when the station itself was launched. This satellite went up later as cargo and was released from the station."
            )
    orbit_type = (record.get("orbit_type") or "").upper()
    if orbit_type == "DOC":
        center = str(record.get("orbit_center") or "")
        if center == "25544":
            facts.append("It is docked to the International Space Station, so it travels with the station.")
        elif center == "48274":
            facts.append("It is docked to Tiangong, so it travels with the Tianhe core module.")
        else:
            facts.append("The catalog lists it as docked to another object, so it is not flying on its own.")
    period = record.get("period_min")
    if period not in (None, ""):
        facts.append(f"One orbit takes about {int(round(float(period)))} minutes.")
    kind = (record.get("object_class") or "").upper()
    ops = (record.get("ops_status") or "").strip()
    if kind == "PAY" and ops == "-":
        facts.append("It is no longer working.")
    elif kind == "PAY" and ops == "P":
        facts.append("It is only partly working.")
    return facts


def _with_status(about: str, record: dict) -> str:
    ops = (record.get("ops_status") or "").strip()
    if ops != "X" or "extended mission" in about:
        return about
    if about.endswith("."):
        return about[:-1] + ", and it is on an extended mission."
    return about + " It is on an extended mission."


def _launched_phrase(record: dict) -> str:
    when = _long_date(record.get("launch_date"))
    site = _SITES.get((record.get("launch_site") or "").upper())
    if when and site:
        return f"{when} from {site}"
    if when:
        return when
    return "a date the public catalog does not list"


def _long_date(value) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        value = value.date()
    if not isinstance(value, date):
        value = date.fromisoformat(str(value)[:10])
    return f"{value.day} {_MONTHS[value.month - 1]} {value.year}"


def _height_label(perigee, apogee) -> str | None:
    if perigee in (None, "") or apogee in (None, ""):
        return None
    low = float(perigee)
    high = float(apogee)
    if abs(high - low) <= 40:
        return f"about {int(round((low + high) / 2)):,} km up"
    return f"{int(round(low)):,}–{int(round(high)):,} km up"
